const NODE_MODULES = '/node_modules/';

// lookup paths for nearest to root for 'dep_name' required by 'consumerPath'

export function candidatePath( consumerPath: string, dep_name: string ): string[] {
    const candidates: string[] = [];

    // TODO: start a consumerPath, push '${prefix}/node_modules/${dep_name}' to candidates, then move up a directory and repeat until root is reached

    return candidates;
}