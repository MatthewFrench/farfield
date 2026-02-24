export interface ReadThreadStateLike {
  thread: {
    id: string;
    turns: object[];
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
    if (input.includeTurns) {
      return input.incoming;
    }
    if (!input.previous) {
      return input.incoming;
    }
    if (input.previous.thread.id !== input.incoming.thread.id) {
      return input.incoming;
    }
    if (input.incoming.thread.turns.length > 0 || input.previous.thread.turns.length === 0) {
      return input.incoming;
    }

    const mergedResponse: TReadThreadState = {
      ...input.incoming
    };
    mergedResponse.thread = {
      ...input.incoming.thread,
      turns: input.previous.thread.turns
    };
    return mergedResponse;
  }
}
