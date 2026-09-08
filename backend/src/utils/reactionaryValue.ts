export class ReactionaryValue<T> {
  private callbacks: ((val: T, oldVal: T) => void)[] = [];
  value: T;

  constructor(defaultValue: T) {
    this.value = defaultValue;
  }

  set(value: T): this {
    for(const cb of this.callbacks) {
      cb(value, this.value);
    }

    this.value = value;

    return this;
  }

  on(cb: (value?: T) => void): this {
    this.callbacks.push(cb);

    return this;
  }
}

export default function createReactionaryValue<T>(defaultValue: T) {
  return new ReactionaryValue(defaultValue);
}
