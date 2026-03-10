export declare class FlowConverterService {
    toEstadoName(label: string): string;
    private uniqueName;
    convertVariablesFtoB(text: string): string;
    convertVariablesBtoF(text: string): string;
    private convertVariablesDeep;
    flowToStateMachine(flowJson: any): {
        estados: any;
        transicoes: any;
        variaveis: any;
    };
    private nodeToHandlerConfig;
    private messageNodeToHandler;
    private decisionNodeToHandler;
    private actionNodeToHandler;
    private connectionToEntrada;
    stateMachineToFlow(estados: any[], transicoes: any[], variaveis?: any[]): {
        nodes: {
            id: any;
            type: any;
            position: any;
            properties: any;
        }[];
        connections: ({
            id: string;
            sourceNodeId: string;
            targetNodeId: string;
            sourcePort: string;
            targetPort: string;
            label: any;
            condition: null;
        } | null)[];
        variables: {
            id: string;
            key: any;
            value: any;
        }[];
    };
    private handlerToNodeType;
    private handlerConfigToProperties;
    private transicaoToSourcePort;
}
