import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as octant from "./octant";

const projectName = pulumi.getProject();

// Create an EKS cluster with the default configuration.
const cluster = new eks.Cluster(projectName, {
    deployDashboard: false }
);

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;

// Create a Namespace for our workloads and export it's name.
const namespace = new k8s.core.v1.Namespace(projectName, undefined, { provider: cluster.provider });
export const namespaceName = namespace.metadata.name;

// Create a NGINX Deployment and Service.
const nginxLabels = { app: "nginx" };
const nginxDeployment = new k8s.apps.v1.Deployment("nginx", {
    metadata: { labels: nginxLabels, namespace: namespaceName },
    spec: {
        replicas: 2,
        selector: { matchLabels: nginxLabels },
        template: {
            metadata: { labels: nginxLabels },
            spec: {
                containers: [{
                    name: projectName,
                    image: "nginx",
                    ports: [{ name: "http", containerPort: 80 }]
                }],
            }
        }
    },
}, { provider: cluster.provider });

const nginxService = new k8s.core.v1.Service(`${projectName}`, {
    metadata: { labels: nginxLabels, namespace: namespaceName },
    spec: {
        type: "LoadBalancer",
        ports: [{ port: 80, targetPort: "http" }],
        selector: nginxLabels,
    },
}, { provider: cluster.provider });

// Export the URL for the load balanced service.
export const nginxUrl = nginxService.status.loadBalancer.ingress[0].hostname;

// Deploy VMware Octant.
const octantLabels = { app: "octant" };
const octantDeployment = octant.createDeployment("octant", {
    replicas: 1,
    image: "quay.io/metral/octant:0.6.0-86d8a32",
    labels: octantLabels,
    namespace: namespaceName,
    provider: cluster.provider,
    containerPort: 7777,
    octantListenerAddr: "0.0.0.0:7777",
    octantDisableOpenBrowser: "1",
});

// Create the VMware Octant Service.
export const octantService = octant.createService("octant", {
    labels: octantLabels,
    namespace: namespaceName,
    provider: cluster.provider,
});

// Export the URL for the Octant Service.
export const octantUrl = octantService.status.loadBalancer.ingress[0].hostname;
