/**
 * FIXME move to 'common' npm package
 */
export interface TreeFile {
    filename: string,
    isSelected?: boolean,
    isDirectory?: boolean,
    isExpanded?: boolean,
    extension?: string,
    content?: string,
    children?: TreeFile[]
}
