const NODE_MODULES = '/node_modules/';

// lookup paths for nearest to root for 'dep_name' required by 'consumerPath'

export function candidatePath( consumerPath: string, dep_name: string ): string[] {
    const candidates: string[] = [];

    // TODO: start a consumerPath, push '${prefix}/node_modules/${dep_name}' to candidates
    // (or 'node_modules/${dep_name}' if prefix is empty), then cut prefix at
    // lastIndexOf(NODE_MODULES) and repeat until prefix is empty

    let prefix = consumerPath;
    
    while (true) {
        const index = prefix.lastIndexOf(NODE_MODULES);
        if (index === -1) {
            break;
        }
    }

    return candidates;
}