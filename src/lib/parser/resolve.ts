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

// First candidate that is an installed node, or null
export function resolveDependency( installed: ReadonlySet<string>, consumerPath: string, depName: string ): string | null {
    for (const candidate of candidatePaths(consumerPath, depName)) {
        if (installed.has(candidate)) {return candidate;}
    }
    return null;
}