import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

const environments = {
  dev: {
    namespace: "mantooth-tasks-dev",
    storage: "hostPath",
    path: "/var/lib/mantooth-tasks/dev",
    imageTag: "dev",
  },
  k3d: {
    namespace: "mantooth-tasks",
    storage: "hostPath",
    path: "/var/lib/mantooth-tasks/prod",
    imageTag: /^sha-[0-9a-f]{40}$/,
  },
  homelab: {
    namespace: "mantooth-tasks",
    storage: "persistentVolumeClaim",
    claimName: "mantooth-tasks-data",
    imageTag: /^sha-[0-9a-f]{40}$/,
  },
};

for (const [environment, expected] of Object.entries(environments)) {
  const output = execFileSync(
    process.env.KUSTOMIZE ?? "kustomize",
    ["build", join("deploy", "overlays", environment)],
    { encoding: "utf8" },
  );
  const resources = parseAllDocuments(output).map((document) => {
    if (document.errors.length > 0) throw document.errors[0];
    return document.toJSON();
  });
  const deployments = resources.filter(
    (resource) => resource?.apiVersion === "apps/v1" && resource?.kind === "Deployment",
  );
  if (deployments.length !== 1) throw new Error(`${environment}: expected one Deployment.`);

  const [deployment] = deployments;
  if (deployment.metadata.namespace !== expected.namespace) {
    throw new Error(`${environment}: Deployment has the wrong namespace.`);
  }
  if (deployment.spec.replicas !== 1 || deployment.spec.strategy.type !== "Recreate") {
    throw new Error(`${environment}: SQLite deployment must remain single-replica and Recreate.`);
  }

  const containers = deployment.spec.template.spec.containers;
  if (containers.length !== 1) throw new Error(`${environment}: expected one app container.`);
  const image = containers[0].image;
  const imageTag = image.slice(image.lastIndexOf(":") + 1);
  const validTag =
    expected.imageTag instanceof RegExp
      ? expected.imageTag.test(imageTag)
      : imageTag === expected.imageTag;
  if (!validTag) throw new Error(`${environment}: image tag is not the expected pinned tag.`);

  const podSpec = deployment.spec.template.spec;
  if (podSpec.automountServiceAccountToken !== false) {
    throw new Error(`${environment}: application pods must not mount a Kubernetes API token.`);
  }
  const containerSecurity = containers[0].securityContext;
  if (
    podSpec.securityContext.runAsNonRoot !== true ||
    podSpec.securityContext.runAsUser !== 10001 ||
    containerSecurity.readOnlyRootFilesystem !== true ||
    containerSecurity.allowPrivilegeEscalation !== false ||
    containerSecurity.capabilities.drop?.includes("ALL") !== true
  ) {
    throw new Error(`${environment}: app container security settings are incomplete.`);
  }
  const dataMounts = containers[0].volumeMounts.filter((mount) => mount.mountPath === "/data");
  const dataVolumes = podSpec.volumes.filter((volume) => volume.name === "data");
  if (dataMounts.length !== 1 || dataVolumes.length !== 1) {
    throw new Error(`${environment}: expected exactly one /data mount and data volume.`);
  }
  const dataVolume = dataVolumes[0];
  const volumeSourceKeys = Object.keys(dataVolume).filter((key) => key !== "name");
  if (volumeSourceKeys.length !== 1 || volumeSourceKeys[0] !== expected.storage) {
    throw new Error(`${environment}: expected exactly one ${expected.storage} storage source.`);
  }

  if (expected.storage === "hostPath") {
    if (dataVolume.hostPath.path !== expected.path || dataVolume.hostPath.type !== "Directory") {
      throw new Error(`${environment}: hostPath does not match the provisioned data path.`);
    }
    if (resources.some((resource) => resource?.kind === "PersistentVolumeClaim")) {
      throw new Error(`${environment}: hostPath overlay must not include a PVC.`);
    }
  } else {
    const claims = resources.filter((resource) => resource?.kind === "PersistentVolumeClaim");
    if (claims.length !== 1 || claims[0].metadata.name !== expected.claimName) {
      throw new Error(`${environment}: expected exactly one application PVC.`);
    }
    if (dataVolume.persistentVolumeClaim.claimName !== expected.claimName) {
      throw new Error(`${environment}: Deployment does not use its PVC.`);
    }
  }

  console.log(
    `${environment}: rendered with one ${expected.storage} data source and pinned image.`,
  );
}
