# Preparing LumaUI for public distribution

LumaUI's current target is WoW Forever. This plan separates the distribution work already present from the validation and presentation needed before a first CurseForge submission.

## Foundations in place

- Standalone compiled addon folders for core and Editor, with TOC dependencies.
- Optional starter import strings, character settings and independent character keybindings.
- Reusable component sharing, named Click Cast presets and reversible native frame hiding.
- English installation and usage documentation, a changelog and MIT license files.
- Type checks, emitted-Lua tests and cross-addon integration checks.
- A tag-triggered GitHub release workflow producing a combined ZIP and checksum.

These are development foundations. Game testing against a named release candidate establishes which client builds and features we can advertise as supported.

## Next milestones

### 1. A clear first-use experience

- Walk through a fresh installation with an empty library. Make the path from **Built-in presets** to Import, Enable and Edit easy to find.
- Verify the empty library explains how to create or import a component, including when Editor is disabled.
- Explain **Save**, manual enable/disable and conditional activation where users encounter them.
- Check import errors, missing dependencies and unavailable actions for actionable messages.
- Keep starter spell choices explicit: the current party/raid starters include Paladin actions, while templates can be customized.

### 2. A visual project page

- Capture an overview of the player display and action buttons in the actual game.
- Capture the editor with its ribbon, readable hierarchy, actual-size preview and inspector.
- Capture party/raid layouts and a short import-to-customization walkthrough.
- Create an original square PNG project logo, at least **400 × 400**, as specified by the [official submission guide](https://support.curseforge.com/support/solutions/articles/9000199552-overview-of-the-project-submission-page).
- Add the verified screenshots to the repository and README before mirroring the description to CurseForge.

Suggested project summary:

> Build, customize and share resource displays, action buttons and group layouts with an in-game visual UI builder.

The README's feature sections provide the project description. Publish screenshots of working features and keep future work in this plan.

### 3. Compatibility and client validation

- Record the exact Forever client version/build used for the candidate and confirm its interface number against both TOCs. The templates currently specify `16001`.
- Confirm the appropriate supported game flavor/version is available in CurseForge's author dashboard. Resolve any mapping questions before tagging a file.
- Validate each additional client flavor independently before listing it as supported. CurseForge's [WoW flavor and TOC guide](https://support.curseforge.com/support/solutions/articles/9000209856) describes the file/version relationship.
- Run the candidate through solo, party and raid changes; pets, disconnect/reconnect; and combat entry/exit.
- Check different UI scales and window sizes, keyboard layouts and client languages.
- Verify reload persistence, component disable/restore, independent keybindings, shared click presets, import/export round trips and activation by native layout.
- Record observed issues and the tested build in the release notes. Use those results to choose the initial Alpha, Beta or Release channel.

### 4. A distributable release candidate

- Build from a clean checkout using the lockfile; run checks and inspect the exact release ZIP.
- Install the ZIP into a clean test setup and confirm both addons load, Editor can be disabled, and icons and preset strings are included.
- Check that the public description, addon metadata, license and credits agree.
- Set the source URL, issue tracker, project summary, logo, categories, release notes and supported versions in the project page.
- Submit the compiled ZIP through CurseForge and verify its installed folder structure after approval.
- Add a CurseForge download link to README once the project has a real public URL.
- Add automated CurseForge publishing after the project ID, file channel and version mapping have been verified with an initial upload.

The [official project submission instructions](https://support.curseforge.com/support/solutions/articles/9000197241-creating-and-submitting-a-project) describe ZIP uploads, release channels, version selection and dependencies. Recheck these fields at submission time.

## Release evidence

For each candidate, record its addon version, commit/tag, client build, tested scenarios, known issues and artifact checksum. Keep user-facing changes in [CHANGELOG.md](../CHANGELOG.md); use [the development guide](development.md) for the build and tag procedure.
