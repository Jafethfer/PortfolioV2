export type Direction = 'right' | 'left' | null;

export type AnimationName =
  | 'idle'
  | 'forward'
  | 'backwards'
  | 'crouch'
  | 'crouchStill'
  | 'crouchForward'
  | 'jumpForward'
  | 'jumpBackward'
  | 'jumpUp'
  | 'jumpFall'
  | 'jumpGround';

export type CharacterAnimations = Record<AnimationName, string>;

export interface CharacterVoices {
  jab?: string;
  punch?: string;
  kick?: string;
  taunt?: string;
  [name: string]: string | undefined;
}

export interface CharacterConfig {
  readonly animations: CharacterAnimations;
  readonly voices?: CharacterVoices;
  readonly walkSpeed?: number;
  readonly crouchSpeed?: number;
  /** Fraction of the surrounding world width covered in a forward/back jump. */
  readonly jumpDistancePct?: number;
  readonly jumpTicks?: number;
  readonly jumpDurationMs?: number;
  readonly jumpApexMs?: number;
  readonly jumpVerticalStep?: number;
  readonly jumpYScale?: number;
  readonly voiceVolume?: number;
}

export const DEFAULT_CONFIG = {
  walkSpeed: 10,
  crouchSpeed: 5,
  jumpDistancePct: 0.30,
  jumpTicks: 33,
  jumpDurationMs: 1000,
  jumpApexMs: 500,
  jumpVerticalStep: 5,
  jumpYScale: 0.3,
  voiceVolume: 0.5,
} as const;
