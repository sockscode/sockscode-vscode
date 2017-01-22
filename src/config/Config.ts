import { workspace } from 'vscode';

export function getConfig() {
    return workspace.getConfiguration('sockscode');
}

export function getSockscodeServerUrl(): string {
    return getConfig().get<string>('server');
}