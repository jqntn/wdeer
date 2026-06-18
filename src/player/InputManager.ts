/**
 * Keyboard + mouse input with pointer lock. Exposes a per-frame snapshot the
 * Player and Weapon read. Mouse look is captured manually (movementX/Y under
 * pointer lock) rather than via a Babylon camera input, for full FPS control.
 */
export class InputManager {
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  /** Toggled stances. */
  crouch = false;
  prone = false;
  /** Held buttons. */
  aiming = false;
  private fireQueued = false;
  pointerLocked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("click", () => {
      if (!this.pointerLocked) void this.canvas.requestPointerLock();
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.code);
    if (e.code === "KeyC") {
      this.crouch = !this.crouch;
      if (this.crouch) this.prone = false;
    }
    if (e.code === "KeyZ") {
      this.prone = !this.prone;
      if (this.prone) this.crouch = false;
    }
  };

  private interactQueued = false;

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
    if (e.code === "KeyE") this.interactQueued = true;
  };

  /** True once per E press (harvest / continue). */
  consumeInteract(): boolean {
    if (this.interactQueued) {
      this.interactQueued = false;
      return true;
    }
    return false;
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.fireQueued = true;
    if (e.button === 2) this.aiming = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) this.aiming = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  /** Forward axis: W=+1, S=-1. */
  get forward(): number {
    return (this.pressed.has("KeyW") ? 1 : 0) - (this.pressed.has("KeyS") ? 1 : 0);
  }

  /** Strafe axis: D=+1, A=-1. */
  get strafe(): number {
    return (this.pressed.has("KeyD") ? 1 : 0) - (this.pressed.has("KeyA") ? 1 : 0);
  }

  /** Shift = sprint (when not aiming) / hold-breath (when aiming). */
  get sprint(): boolean {
    return this.pressed.has("ShiftLeft") && !this.aiming;
  }

  get holdBreath(): boolean {
    return this.pressed.has("ShiftLeft") && this.aiming;
  }

  /** Consume accumulated mouse delta since last frame. */
  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** True once per trigger pull. */
  consumeFire(): boolean {
    if (this.fireQueued) {
      this.fireQueued = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
  }
}
