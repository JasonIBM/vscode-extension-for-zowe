/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import * as vscode from "vscode";
import {
    createInstanceOfProfile,
    createIProfile,
    createISessionWithoutCredentials, createQuickPickContent, createQuickPickItem, createTreeView
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils";
import * as globals from "../../../src/globals";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as sharedActions from "../../../src/shared/actions";
import { createUSSSessionNode, createUSSTree } from "../../../__mocks__/mockCreators/uss";
import * as dsActions from "../../../src/dataset/actions";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";

async function createGlobalMocks() {
    const globalMocks = {
        qpPlaceholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer"
    };

    Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });

    return globalMocks;
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Shared Actions Unit Tests - Function searchForLoadedItems", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            imperativeProfile: createIProfile(),
            profileInstance: null,
            datasetSessionNode: null,
            ussSessionNode: null,
            testDatasetTree: null,
            testUssTree: null
        };

        newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
        // It's required to have proper mock of profile for USS Node generation
        mocked(Profiles.getInstance).mockReturnValue(newMocks.profileInstance);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.ussSessionNode = createUSSSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testUssTree = createUSSTree([], [newMocks.ussSessionNode], newMocks.treeView);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        return newMocks;
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking that searchForLoadedItems works for a PDS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const testNode = new ZoweDatasetNode("HLQ.PROD2.STUFF", null,
            blockMocks.datasetSessionNode, blockMocks.session, globals.DS_PDS_CONTEXT);
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        blockMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([testNode]);
        blockMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        blockMocks.testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([blockMocks.datasetSessionNode]);
            }
        });

        const qpItem = new utils.FilterItem("[sestest]: HLQ.PROD2.STUFF");
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(blockMocks.testDatasetTree, blockMocks.testUssTree);
        expect(blockMocks.testDatasetTree.addHistory).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a member", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const testNode = new ZoweDatasetNode("HLQ.PROD2.STUFF", null,
            blockMocks.datasetSessionNode, blockMocks.session, globals.DS_DS_CONTEXT);
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const testMember = new ZoweDatasetNode("TESTMEMB", null, testNode,
            blockMocks.session, globals.DS_MEMBER_CONTEXT);
        testMember.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        testNode.children.push(testMember);
        blockMocks.testDatasetTree.getChildren.mockReturnValue([blockMocks.datasetSessionNode]);

        jest.spyOn(dsActions, "openPS").mockResolvedValueOnce(null);
        blockMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([testMember]);
        blockMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        blockMocks.testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg === testNode) {
                return Promise.resolve([testMember]);
            } else if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([blockMocks.datasetSessionNode]);
            }
        });
        const qpItem = new utils.FilterItem("[sestest]: HLQ.PROD2.STUFF(TESTMEMB)");
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(blockMocks.testDatasetTree, blockMocks.testUssTree);
        expect(blockMocks.testDatasetTree.addHistory).toBeCalledWith("HLQ.PROD2.STUFF(TESTMEMB)");
    });
    it("Checking that searchForLoadedItems works for a USS folder", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussSessionNode, null, "/");
        blockMocks.testDatasetTree.getChildren.mockReturnValue([blockMocks.ussSessionNode]);

        blockMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        blockMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getProfileName").mockImplementationOnce(() => "firstName");
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);

        const qpItem = new utils.FilterItem("[sestest]: /folder");
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        const openNode = jest.spyOn(folder, "openUSS");
        await sharedActions.searchInAllLoadedItems(blockMocks.testDatasetTree, blockMocks.testUssTree);
        expect(openNode).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.ussSessionNode, null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
        blockMocks.testDatasetTree.getChildren.mockReturnValue([blockMocks.ussSessionNode]);

        blockMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        blockMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([file]);
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getChildren").mockResolvedValueOnce([file]);

        const qpItem = new utils.FilterItem("[sestest]: /folder/file");
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        const openNode = jest.spyOn(file, "openUSS");
        await sharedActions.searchInAllLoadedItems(blockMocks.testDatasetTree, blockMocks.testUssTree);

        expect(blockMocks.testUssTree.addHistory).toBeCalledWith("/folder/file");
        expect(openNode).toHaveBeenCalledWith(false, true, blockMocks.testUssTree);
    });
    it("Checking that searchForLoadedItems fails when no pattern is entered", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        blockMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        const qpItem = null;
        const quickPickContent = createQuickPickContent(qpItem, qpItem, globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(blockMocks.testDatasetTree, blockMocks.testUssTree);
        expect(blockMocks.testUssTree.addHistory).not.toBeCalled();
    });
});

describe("Shared Actions Unit Tests - Function openRecentMemberPrompt", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            dsNode: null,
            testUSSTree: null,
            testDatasetTree: null,
            imperativeProfile: createIProfile(),
            profileInstance: null,
            datasetSessionNode: null,
            ussSessionNode: null,
            quickPickItem: createQuickPickItem()
        };

        newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(newMocks.profileInstance);
        newMocks.dsNode = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, newMocks.datasetSessionNode, null);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.ussSessionNode = createUSSSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testUSSTree = createUSSTree([], [newMocks.ussSessionNode], newMocks.treeView);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        return newMocks;
    }

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a PDS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, blockMocks.dsNode, blockMocks.session);
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        child.pattern = child.label;
        const qpItem = new utils.FilterDescriptor(child.label);
        const quickPickContent = createQuickPickContent("[sestest]: node(child)", [qpItem], globalMocks.qpPlaceholder);

        mocked(blockMocks.testDatasetTree.getRecall).mockReturnValueOnce([`[sestest]: node(child)`]);
        mocked(blockMocks.testUSSTree.getRecall).mockReturnValueOnce([]);
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(blockMocks.testDatasetTree, blockMocks.testUSSTree);
        expect(blockMocks.testDatasetTree.openItemFromPath).toBeCalledWith(`[sestest]: node(child)`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a DS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.dsNode.contextValue = globals.DS_DS_CONTEXT;
        const qpItem = new utils.FilterDescriptor(blockMocks.dsNode.label);
        const quickPickContent = createQuickPickContent("[sestest]: node", [qpItem], globalMocks.qpPlaceholder);

        mocked(blockMocks.testDatasetTree.getRecall).mockReturnValueOnce([`[sestest]: node`]);
        mocked(blockMocks.testUSSTree.getRecall).mockReturnValueOnce([]);
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(blockMocks.testDatasetTree, blockMocks.testUSSTree);
        expect(blockMocks.testDatasetTree.openItemFromPath).toBeCalledWith(`[sestest]: node`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();

        const node = new ZoweUSSNode("node3.txt", vscode.TreeItemCollapsibleState.None, blockMocks.ussSessionNode, null, "/node1/node2");
        node.contextValue = globals.DS_DS_CONTEXT;
        const qpItem = new utils.FilterDescriptor(node.label);
        const quickPickContent = createQuickPickContent("[sestest]: /node1/node2/node3.txt", [qpItem], globalMocks.qpPlaceholder);

        mocked(blockMocks.testDatasetTree.getRecall).mockReturnValueOnce([]);
        mocked(blockMocks.testUSSTree.getRecall).mockReturnValueOnce([`[sestest]: /node1/node2/node3.txt`]);
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(blockMocks.testDatasetTree, blockMocks.testUSSTree);
        expect(blockMocks.testUSSTree.openItemFromPath).toBeCalledWith(`/node1/node2/node3.txt`, blockMocks.ussSessionNode);
    });
});
