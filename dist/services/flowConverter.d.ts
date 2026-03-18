declare function toEstadoNameOg(label: any): any;
declare function convertVariablesFtoBOg(text: any): any;
declare function convertVariablesBtoFOg(text: any): any;
declare function flowToStateMachineOg(flowJson: any): {
    estados: any;
    transicoes: any;
    variaveis: any;
};
declare function stateMachineToFlowOg(estados: any[], transicoes: any[], variaveis?: any[]): {
    nodes: {
        id: any;
        type: any;
        position: any;
        properties: any;
    }[];
    connections: ({
        id: string;
        sourceNodeId: any;
        targetNodeId: any;
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
export declare const flowToStateMachine: typeof flowToStateMachineOg;
export declare const stateMachineToFlow: typeof stateMachineToFlowOg;
export declare const toEstadoName: typeof toEstadoNameOg;
export declare const convertVariablesFtoB: typeof convertVariablesFtoBOg;
export declare const convertVariablesBtoF: typeof convertVariablesBtoFOg;
export {};
