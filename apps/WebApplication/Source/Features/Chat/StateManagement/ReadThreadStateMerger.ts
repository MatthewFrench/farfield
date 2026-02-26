export interface ReadThreadStateLike<TTurn = object> {
  thread: {
    id: string;
    turns: TTurn[];
  };
}

export interface ReadThreadStateMergeInput<TReadThreadState extends ReadThreadStateLike> {
  previous: TReadThreadState | null;
  incoming: TReadThreadState;
  includeTurns: boolean;
}

export class ReadThreadStateMerger {
  public merge<TReadThreadState extends ReadThreadStateLike>(
    input: ReadThreadStateMergeInput<TReadThreadState>
  ): TReadThreadState {
    const previousState = input.previous;
    if (input.includeTurns) {
      return input.incoming;
    }
    if (!previousState) {
      return input.incoming;
    }
    if (previousState.thread.id !== input.incoming.thread.id) {
      return input.incoming;
    }
    if (input.incoming.thread.turns.length > 0 || previousState.thread.turns.length === 0) {
      return input.incoming;
    }

    return {
      ...input.incoming,
      thread: {
        ...input.incoming.thread,
        turns: previousState.thread.turns
      }
    };
  }
}
