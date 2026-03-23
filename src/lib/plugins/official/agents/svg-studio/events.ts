export interface SvgStudioSuccessEvent {
  type: 'success';
  svg: string;
}

export interface SvgStudioErrorEvent {
  type: 'error';
  message: string;
}

export type SvgStudioEvent = SvgStudioSuccessEvent | SvgStudioErrorEvent;
