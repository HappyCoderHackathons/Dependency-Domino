const NODE_MODULES = '/node_modules/';

// lookup paths for nearest to root for 'dep_name' required by 'consumerPath'

export function candidatePaths( consumerPath: string, dep_name: string ): string[] {
    const candidates: string[] = [];

    let prefix = consumerPath;

    while (true) {
        const index = prefix.lastIndexOf(NODE_MODULES);
        if (index === -1) {
            break;
        }
    }

    return candidates;
}