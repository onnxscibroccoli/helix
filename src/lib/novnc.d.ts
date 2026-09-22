declare module "@novnc/novnc" {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: Record<string, unknown>);
    disconnect(): void;
    sendCtrlAltDel(): void;
    scaleViewport: boolean;
    resizeSession: boolean;
    viewOnly: boolean;
    clipViewport: boolean;
    focusOnClick: boolean;
    background: string;
    addEventListener(type: string, listener: (ev: { detail?: { clean?: boolean } }) => void): void;
    removeEventListener(type: string, listener: (ev: { detail?: { clean?: boolean } }) => void): void;
    focus(): void;
  }
}
