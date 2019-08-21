import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Create the VMware Octant Deployment.
interface OctantDeploymentArgs {
    replicas: pulumi.Input<number>;
    image: pulumi.Input<string>;
    labels: pulumi.Input<any>;
    namespace: pulumi.Input<string>;
    provider: k8s.Provider;
    containerPort: pulumi.Input<number>;
    octantListenerAddr: pulumi.Input<string>;
    octantDisableOpenBrowser: pulumi.Input<string>;
    octantAcceptedHosts?: pulumi.Input<string>;
}
export function createDeployment(
    name: string,
    args: OctantDeploymentArgs,
): k8s.apps.v1.Deployment {

    // Create ServiceAccount.
    const serviceAccount = makeServiceAccount(name, {
        namespace: args.namespace,
        provider: args.provider,
    });
    const serviceAccountName = serviceAccount.metadata.name;

    // Create ClusterRole Binding to 'cluster-admin' Role.
    const clusterRoleName = "cluster-admin";
    const clusterRoleBinding = makeClusterRoleBinding(name, {
        namespace: args.namespace,
        serviceAccountName: serviceAccountName,
        clusterRoleName: clusterRoleName,
        provider: args.provider,
    });

    return new k8s.apps.v1.Deployment(name,
        {
            metadata: {
                labels: args.labels,
                namespace: args.namespace,
            },
            spec: {
                replicas: args.replicas,
                selector: { matchLabels: args.labels },
                template: {
                    metadata: { labels: args.labels, namespace: args.namespace },
                    spec: {
                        serviceAccountName: serviceAccountName,
                        containers: [
                            {
                                name: name,
                                image: args.image,
                                imagePullPolicy: "Always",
                                ports: [{ name: "http", containerPort: args.containerPort }],
                                command: ["/bin/sh","-c"],
                                args: [
                                    "/usr/local/bin/launch.sh; /app/octant -v --kubeconfig=$HOME/.kube/config --context=default-context",
                                ],
                                env: [
                                    {
                                        name: "OCTANT_LISTENER_ADDR",
                                        value: args.octantListenerAddr,
                                    },
                                    {
                                        name: "OCTANT_ACCEPTED_HOSTS",
                                        value: args.octantAcceptedHosts,
                                    },
                                    {
                                        name: "OCTANT_DISABLE_OPEN_BROWSER",
                                        value: args.octantListenerAddr,
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        },
        {
            provider: args.provider,
        },
    )
}

// Create the VMware Octant Service.
interface OctantServiceArgs {
    labels: pulumi.Input<any>;
    namespace: pulumi.Input<string>;
    provider: k8s.Provider;
}
export function createService(
    name: string,
    args: OctantServiceArgs,
): k8s.core.v1.Service {
    return new k8s.core.v1.Service(
        name,
        {
            metadata: {
                labels: args.labels,
                namespace: args.namespace,
            },
            spec: {
                type: "LoadBalancer",
                ports: [{port: 80, protocol: "TCP", targetPort: "http"}],
                selector: args.labels,
            },
        },
        {
            provider: args.provider,
        },
    );
}

// Create a ServiceAccount.
interface ServiceAccountArgs {
    namespace: pulumi.Input<string>;
    provider: k8s.Provider;
}
export function makeServiceAccount(
    name: string,
    args: ServiceAccountArgs,
): k8s.core.v1.ServiceAccount {
    return new k8s.core.v1.ServiceAccount(
        name,
        {
            metadata: {
                namespace: args.namespace,
            },
        },
        {
            provider: args.provider,
        },
    );
}

// Create a ClusterRoleBinding of the ServiceAccount -> ClusterRole.
interface ClusterRoleBindingArgs {
    namespace: pulumi.Input<string>;
    serviceAccountName: pulumi.Input<string>;
    clusterRoleName: pulumi.Input<string>;
    provider: k8s.Provider;
}
export function makeClusterRoleBinding(
    name: string,
    args: ClusterRoleBindingArgs,
): k8s.rbac.v1.ClusterRoleBinding {
    return new k8s.rbac.v1.ClusterRoleBinding(
        name,
        {
            subjects: [
                {
                    kind: "ServiceAccount",
                    name: args.serviceAccountName,
                    namespace: args.namespace,
                },
            ],
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: args.clusterRoleName,
            },
        },
        {
            provider: args.provider,
        },
    );
}
