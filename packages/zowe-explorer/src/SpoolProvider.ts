/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { Profiles } from "./Profiles";
import { ZoweLogger } from "./utils/LoggerUtils";
import { IZoweJobTreeNode } from "@zowe/zowe-explorer-api";

export default class SpoolProvider implements vscode.TextDocumentContentProvider {
    public static scheme = "zosspool";

    private mOnDidChange = new vscode.EventEmitter<vscode.Uri>();

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        ZoweLogger.trace("SpoolProvider.provideTextDocumentContent called.");
        const [sessionName, spool] = decodeJobFile(uri);
        const profile = Profiles.getInstance().loadNamedProfile(sessionName);
        const result = await ZoweExplorerApiRegister.getJesApi(profile).getSpoolContentById(spool.jobname, spool.jobid, spool.id);
        return result;
    }

    public dispose(): void {
        this.mOnDidChange.dispose();
    }
}

/**
 * @deprecated because of lack of the VSCode built in cache invalidation support
 * Please, use the {@link toUniqueJobFileUri} instead
 *
 * Encode the information needed to get the Spool content.
 *
 * @param session The name of the Zowe profile to use to get the Spool Content
 * @param spool The IJobFile to get the spool content for.
 */
export function encodeJobFile(session: string, spool: zowe.IJobFile): vscode.Uri {
    ZoweLogger.trace("SpoolProvider.encodeJobFile called.");
    const query = JSON.stringify([session, spool]);
    return vscode.Uri.parse("").with({
        scheme: SpoolProvider.scheme,
        path: `${spool.jobname}.${spool.jobid}.${spool.ddname}`,
        query,
    });
}

/**
 * Encode the information needed to get the Spool content with support of the built in VSCode cache invalidation.
 *
 * VSCode built in cache will be applied automatically in case of several requests for the same URI,
 * so consumers can control the amount of spool content requests by specifying different unique fragments
 *
 * Should be used carefully because of the possible memory leaks.
 *
 * @param session The name of the Zowe profile to use to get the Spool Content
 * @param spool The IJobFile to get the spool content for.
 * @param uniqueFragment The unique fragment of the encoded uri (can be timestamp, for example)
 */
export const toUniqueJobFileUri =
    (session: string, spool: zowe.IJobFile) =>
        (uniqueFragment: string): vscode.Uri => {
            ZoweLogger.trace("SpoolProvider.toUniqueJobFileUri called.");
            const encodedUri = encodeJobFile(session, spool);
            return encodedUri.with({
                fragment: uniqueFragment,
            });
        };

/**
 * Gather all spool files for a given job
 * @param node Selected node for which to extract all spool files
 * @returns Array of spool files
 */
export async function getSpoolFiles(node: IZoweJobTreeNode): Promise<zowe.IJobFile[]> {
    ZoweLogger.trace("SpoolProvider.getSpoolFiles called.");
    if (node.job == null) return [];
    let spools: zowe.IJobFile[] = [];
    spools = await ZoweExplorerApiRegister.getJesApi(node.getProfile()).getSpoolFiles(node.job.jobname, node.job.jobid);
    spools = spools
        // filter out all the objects which do not seem to be correct Job File Document types
        // see an issue #845 for the details
        .filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
    return spools;
}

/**
 * Determine whether or not a spool file matches a selected node
 *
 * @param spool Individual spool file to match the node with
 * @param node Selected node
 * @returns true if the selected node matches the spool file, false otherwise
 */
export function matchSpool(spool: zowe.IJobFile, node: IZoweJobTreeNode) {
    return `${spool.stepname}:${spool.ddname} - ${spool["record-count"]}` === node.label.toString() ||
        `${spool.stepname}:${spool.ddname} - ${spool.procstep}` === node.label.toString();
}

/**
 * Decode the information needed to get the Spool content.
 *
 * @param uri The URI passed to TextDocumentContentProvider
 */
export function decodeJobFile(uri: vscode.Uri): [string, zowe.IJobFile] {
    ZoweLogger.trace("SpoolProvider.decodeJobFile called.");
    const [session, spool] = JSON.parse(uri.query) as [string, zowe.IJobFile];
    return [session, spool];
}

export function initializeSpoolProvider(context: vscode.ExtensionContext): void {
    ZoweLogger.trace("SpoolProvider.initializeSpoolProvider called.");
    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider));
    context.subscriptions.push(spoolProvider, providerRegistration);
}
