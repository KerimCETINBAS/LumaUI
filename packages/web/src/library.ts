import { createSignal } from "solid-js";

/** A saved hierarchy node. Not a data source. */
export interface SampleNode {
  id: string;
  name: string;
  kind: string;
  depth: number;
  attrs?: Record<string, string>;
}

export interface PartRecord {
  id: string;
  name: string;
  summary: string;
  nodes: SampleNode[];
}

export interface ModuleRecord {
  id: string;
  name: string;
  summary: string;
  headless: boolean;
  nodes: SampleNode[];
}

export interface RegionRecord {
  id: string;
  name: string;
  summary: string;
  nodes: SampleNode[];
}

interface LegacyPlacement {
  id: string;
  name: string;
  kind: "Module" | "Part";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProfileRecord {
  id: string;
  name: string;
  summary: string;
  activation: string[];
  regionIds: string[];
  moduleIds: string[];
  /** Name paths: Region, or Profile.Region. */
  regionRefs: string[];
}

interface Library {
  parts: PartRecord[];
  modules: ModuleRecord[];
  regions: RegionRecord[];
  profiles: ProfileRecord[];
}

const storageKey = "luma.library";
const empty: Library = { parts: [], modules: [], regions: [], profiles: [] };

function read(): Library {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return empty;
    const parsed = JSON.parse(raw) as Partial<Library>;
    return {
      parts: parsed.parts ?? [],
      modules: parsed.modules ?? [],
      regions: (parsed.regions ?? []).map(region => normalizeRegion(region as RegionRecord & { placements?: LegacyPlacement[] })),
      profiles: (parsed.profiles ?? []).map(profile => ({
        id: profile.id ?? uid(),
        name: profile.name ?? "Untitled profile",
        summary: profile.summary ?? "A profile only decides when regions and modules turn on.",
        activation: profile.activation ?? [],
        regionIds: profile.regionIds ?? [],
        moduleIds: profile.moduleIds ?? [],
        regionRefs: profile.regionRefs ?? [],
      })),
    };
  } catch {
    return empty;
  }
}

const [library, setLibrary] = createSignal<Library>(read());

function write(next: Library) {
  setLibrary(next);
  localStorage.setItem(storageKey, JSON.stringify(next));
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

function normalizeRegion(region: Partial<RegionRecord> & { placements?: LegacyPlacement[] }): RegionRecord {
  const id = region.id ?? uid();
  const name = region.name ?? "Untitled region";
  const summary = region.summary ?? "Children stay where they are anchored.";
  if (region.nodes !== undefined && region.nodes.length > 0) return { id, name, summary, nodes: region.nodes };
  const placed = region.placements ?? [];
  return {
    id,
    name,
    summary,
    nodes: [
      { id, name, kind: "Region", depth: 0 },
      ...placed.map(place => ({
        id: place.kind === "Module" ? place.id : `${place.id}-part`,
        name: place.name,
        kind: place.kind,
        depth: 1,
        attrs: {
          ...(place.kind === "Module" ? { moduleId: place.id } : { partName: place.name }),
          name: place.name,
          anchor: "TL",
          offsetX: String(place.x),
          offsetY: String(place.y),
          width: String(place.width),
          height: String(place.height),
        },
      })),
    ],
  };
}

export function placedModuleIds(region: RegionRecord): string[] {
  return region.nodes.filter(node => node.depth > 0 && node.kind === "Module").map(node => node.attrs?.moduleId || node.id);
}

export function parts(): PartRecord[] {
  return library().parts;
}

export function modules(): ModuleRecord[] {
  return library().modules;
}

export function regions(): RegionRecord[] {
  return library().regions;
}

export function profiles(): ProfileRecord[] {
  return library().profiles;
}

export function findPart(id: string): PartRecord | undefined {
  return library().parts.find(part => part.id === id);
}

export function findModule(id: string): ModuleRecord | undefined {
  return library().modules.find(item => item.id === id);
}

export function findRegion(id: string): RegionRecord | undefined {
  return library().regions.find(region => region.id === id);
}

export function findProfile(id: string): ProfileRecord | undefined {
  return library().profiles.find(profile => profile.id === id);
}

export function modulesUsing(partId: string): ModuleRecord[] {
  const part = findPart(partId);
  if (part === undefined) return [];
  return library().modules.filter(item => item.nodes.some(node => node.kind === "Part" && resolvePart(node.attrs?.partName || node.name)?.id === part.id));
}

export function moduleHosts(moduleId: string): string[] {
  const names = new Set<string>();
  for (const profile of library().profiles) {
    if (profile.moduleIds.includes(moduleId)) names.add(profile.name);
    for (const regionId of profile.regionIds) {
      const region = library().regions.find(item => item.id === regionId);
      if (region !== undefined && placedModuleIds(region).includes(moduleId)) names.add(region.name);
    }
  }
  return [...names];
}

export function createProfile(): ProfileRecord {
  const profile: ProfileRecord = {
    id: uid(),
    name: "Untitled profile",
    summary: "A profile only decides when regions and modules turn on.",
    activation: [],
    regionIds: [],
    moduleIds: [],
    regionRefs: [],
  };
  write({ ...library(), profiles: [...library().profiles, profile] });
  return profile;
}

export function createPart(): PartRecord {
  const id = uid();
  const part: PartRecord = {
    id,
    name: "Untitled part",
    summary: "A part is placed inside a module or a region.",
    nodes: [{ id, name: "Untitled part", kind: "Part", depth: 0 }],
  };
  write({ ...library(), parts: [...library().parts, part] });
  return part;
}

export function createModule(): ModuleRecord {
  const id = uid();
  const item: ModuleRecord = {
    id,
    name: "Untitled module",
    summary: "A module can stand on its own.",
    headless: false,
    nodes: [{ id, name: "Untitled module", kind: "Module", depth: 0 }],
  };
  write({ ...library(), modules: [...library().modules, item] });
  return item;
}

export function createRegion(): RegionRecord {
  const id = uid();
  const region: RegionRecord = {
    id,
    name: "Untitled region",
    summary: "Children stay where they are anchored.",
    nodes: [{ id, name: "Untitled region", kind: "Region", depth: 0 }],
  };
  write({ ...library(), regions: [...library().regions, region] });
  return region;
}

export function updateProfile(id: string, patch: Partial<ProfileRecord>) {
  write({ ...library(), profiles: library().profiles.map(profile => profile.id === id ? { ...profile, ...patch } : profile) });
}

export function updatePart(id: string, patch: Partial<PartRecord>) {
  write({ ...library(), parts: library().parts.map(part => part.id === id ? { ...part, ...patch } : part) });
}

export function updateModule(id: string, patch: Partial<ModuleRecord>) {
  write({ ...library(), modules: library().modules.map(item => item.id === id ? { ...item, ...patch } : item) });
}

export function updateRegion(id: string, patch: Partial<RegionRecord>) {
  write({ ...library(), regions: library().regions.map(region => region.id === id ? { ...region, ...patch } : region) });
}

export function attachRegion(profileId: string, regionId: string) {
  const profile = findProfile(profileId);
  if (profile === undefined || profile.regionIds.includes(regionId)) return;
  updateProfile(profileId, { regionIds: [...profile.regionIds, regionId] });
}

export function attachModule(profileId: string, moduleId: string) {
  const profile = findProfile(profileId);
  if (profile === undefined || profile.moduleIds.includes(moduleId)) return;
  updateProfile(profileId, { moduleIds: [...profile.moduleIds, moduleId] });
}

export function attachRegionRef(profileId: string, path: string) {
  const profile = findProfile(profileId);
  const region = resolveRegion(path, profileId);
  if (profile === undefined || region === undefined) return;
  if (profile.regionIds.includes(region.id)) return;
  if (profile.regionRefs.some(ref => resolveRegion(ref, profileId)?.id === region.id)) return;
  updateProfile(profileId, { regionRefs: [...profile.regionRefs, path] });
}

export interface NamePath {
  path: string;
  scope: "Part" | "Region" | "Profile";
}

function segments(path: string): string[] {
  return path.split(".").map(bit => bit.trim()).filter(bit => bit.length > 0);
}

export function resolveRegion(path: string, profileId?: string): RegionRecord | undefined {
  const bits = segments(path);
  if (bits.length === 0) return undefined;
  if (bits.length === 1) {
    if (profileId !== undefined) {
      const owned = findProfile(profileId)?.regionIds.map(id => findRegion(id)).find(region => region?.name === bits[0]);
      if (owned !== undefined) return owned;
    }
    return regions().find(region => region.name === bits[0]);
  }
  const profile = profiles().find(item => item.name === bits[0]);
  const name = bits.slice(1).join(".");
  return profile?.regionIds.map(id => findRegion(id)).find(region => region?.name === name);
}

export function resolvePart(path: string, profileId?: string, seen = new Set<string>()): PartRecord | undefined {
  const key = `${profileId ?? "*"}:${path}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const bits = segments(path);
  if (bits.length === 0) return undefined;
  if (bits.length === 1) return parts().find(part => part.name === bits[0]);
  if (bits.length === 2) return partOnRegion(regionByName(bits[0], profileId), bits[1], seen);
  const profile = profiles().find(item => item.name === bits[0]);
  const region = profile?.regionIds.map(id => findRegion(id)).find(item => item?.name === bits[1]);
  return partOnRegion(region, bits.slice(2).join("."), seen);
}

function regionByName(name: string, profileId?: string): RegionRecord | undefined {
  if (profileId !== undefined) {
    const owned = findProfile(profileId)?.regionIds.map(id => findRegion(id)).find(region => region?.name === name);
    if (owned !== undefined) return owned;
  }
  return regions().find(region => region.name === name);
}

function partOnRegion(region: RegionRecord | undefined, partName: string, seen: Set<string>): PartRecord | undefined {
  if (region === undefined) return parts().find(part => part.name === partName);
  const node = region.nodes.find(item => item.depth > 0 && item.kind === "Part" && (item.name === partName || item.attrs?.partName === partName));
  if (node === undefined) return parts().find(part => part.name === partName);
  const target = node.attrs?.partName || node.name;
  if (target === partName) return parts().find(part => part.name === partName);
  return resolvePart(target, undefined, seen);
}

export function partReferencePaths(profileId?: string): NamePath[] {
  const rows: NamePath[] = parts().map(part => ({ path: part.name, scope: "Part" }));
  const seen = new Set(rows.map(row => row.path));
  const regionNames = new Map<string, number>();
  for (const region of regions()) regionNames.set(region.name, (regionNames.get(region.name) ?? 0) + 1);
  for (const profile of profiles()) {
    const same = profileId !== undefined && profile.id === profileId;
    for (const regionId of profile.regionIds) {
      const region = findRegion(regionId);
      if (region === undefined) continue;
      const short = same || (profileId === undefined && (regionNames.get(region.name) ?? 0) === 1);
      for (const node of region.nodes) {
        if (node.depth === 0 || node.kind !== "Part") continue;
        const label = node.name || node.attrs?.partName || "";
        if (label.length === 0 || label.includes(".")) continue;
        const path = short ? `${region.name}.${label}` : `${profile.name}.${region.name}.${label}`;
        if (seen.has(path)) continue;
        seen.add(path);
        rows.push({ path, scope: short ? "Region" : "Profile" });
      }
    }
  }
  return rows;
}

export function regionReferencePaths(profileId: string): NamePath[] {
  const profile = findProfile(profileId);
  const taken = new Set<string>(profile?.regionIds ?? []);
  for (const path of profile?.regionRefs ?? []) {
    const region = resolveRegion(path, profileId);
    if (region !== undefined) taken.add(region.id);
  }
  const rows: NamePath[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const region of regions()) counts.set(region.name, (counts.get(region.name) ?? 0) + 1);
  for (const region of regions()) {
    if (taken.has(region.id) || (counts.get(region.name) ?? 0) !== 1) continue;
    rows.push({ path: region.name, scope: "Region" });
    seen.add(region.name);
  }
  for (const other of profiles()) {
    if (other.id === profileId) continue;
    for (const regionId of other.regionIds) {
      const region = findRegion(regionId);
      if (region === undefined || taken.has(region.id)) continue;
      const path = `${other.name}.${region.name}`;
      if (seen.has(path)) continue;
      seen.add(path);
      rows.push({ path, scope: "Profile" });
    }
  }
  return rows;
}

export function profileRegions(profile: ProfileRecord): { region: RegionRecord; path: string; owned: boolean }[] {
  const rows: { region: RegionRecord; path: string; owned: boolean }[] = [];
  const seen = new Set<string>();
  for (const id of profile.regionIds) {
    const region = findRegion(id);
    if (region === undefined || seen.has(region.id)) continue;
    seen.add(region.id);
    rows.push({ region, path: region.name, owned: true });
  }
  for (const path of profile.regionRefs) {
    const region = resolveRegion(path, profile.id);
    if (region === undefined || seen.has(region.id)) continue;
    seen.add(region.id);
    rows.push({ region, path, owned: false });
  }
  return rows;
}

