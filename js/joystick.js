/**
 * Virtual joystick — bottom-left, touch + mouse.
 * Outputs normalized vector { x, y } in [-1, 1].
 */
export class Joystick {
  constructor(baseEl, stickEl) {
    this.base = baseEl;
    this.stick = stickEl;
    this.active = false;
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this._max = 42;
    this._rect = null;
    this._bind();
    this._onResize = () => this._updateRect();
    window.addEventListener('resize', this._onResize);
    this._updateRect();
  }

  _updateRect() {
    this._rect = this.base.getBoundingClientRect();
    this._max = Math.min(this._rect.width, this._rect.height) * 0.36;
  }

  _bind() {
    const start = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._updateRect();
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this.active = true;
      this.pointerId = t.identifier ?? 'mouse';
      this._move(t.clientX, t.clientY);
    };
    const move = (e) => {
      if (!this.active) return;
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier ?? 'mouse';
        if (id !== this.pointerId && this.pointerId !== 'mouse') continue;
        e.preventDefault();
        this._move(t.clientX, t.clientY);
        break;
      }
    };
    const end = (e) => {
      if (!this.active) return;
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier ?? 'mouse';
        if (id !== this.pointerId && this.pointerId !== 'mouse') continue;
        this.active = false;
        this.pointerId = null;
        this.x = 0;
        this.y = 0;
        this.stick.style.transform = 'translate(-50%, -50%)';
        break;
      }
    };

    this.base.addEventListener('touchstart', start, { passive: false });
    this.base.addEventListener('mousedown', start);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    window.addEventListener('mouseup', end);
  }

  _move(cx, cy) {
    const cx0 = this._rect.left + this._rect.width / 2;
    const cy0 = this._rect.top + this._rect.height / 2;
    let dx = cx - cx0;
    let dy = cy - cy0;
    const len = Math.hypot(dx, dy) || 1;
    if (len > this._max) {
      dx = (dx / len) * this._max;
      dy = (dy / len) * this._max;
    }
    this.x = dx / this._max;
    this.y = dy / this._max;
    this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  /** Forward = -y (screen up), right = +x */
  get vector() {
    return { x: this.x, y: -this.y };
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
  }
}
