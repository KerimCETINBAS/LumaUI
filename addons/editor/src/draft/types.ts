import { Store } from "wuira/store";
import type { ActivationMode, CollectionClass, CollectionCondition, ElementSection, PresetDocument, PresetNode, Properties, SourceSpec } from "lumaui/core";

export type NodeKind = string;
export interface EditorNode {
    label?: string;
    activation?: PresetNode["activation"];
    sourceProps?: PresetNode["sourceProps"];
    bindings?: PresetNode["bindings"];
    id: string;
    parent: string;
    kind: NodeKind;
    name: string;
    width: number;
    height: number;
    direction: "horizontal" | "vertical";
    props?: Properties;
    source?: string;
    items?: string;
    sourcePath?: string;
    visibleSource?: string;
    visiblePath?: string;
    visibleWhen?: "true" | "false";
    textSource?: string;
    alphaSource?: string;
    preset?: string;
    sections?: ElementSection[];
}
export class EditorSettings extends Store {
    public static readonly Token = "lumaui.editor";
    public version = 2;
    public documentId = "editor-draft";
    public documentName = "LumaUI draft";
    public owner?: string;
    public activationMode: ActivationMode = "condMet";
    public collectionClass: CollectionClass | "" = "";
    public collectionCondition: CollectionCondition | "" = "";
    public nativeLayout = "";
    public layoutPositions?: PresetDocument["layoutPositions"];
    public sources: SourceSpec[] = [];
    public nodes: EditorNode[] = [];
    public nextId = 1;
    public dependencies: PresetDocument[] = [];
    public sourceRenames: { oldName: string; newName: string; updateReferences: boolean; input?: boolean }[] = [];
    public appliedSourceRenames: EditorSettings["sourceRenames"] = [];
}
