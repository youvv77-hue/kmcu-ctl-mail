# KMCU CTL mailing builder

The app is a standalone `index.html`, hosted on the existing GitHub Pages site.
No build step is needed to open the current HTML. Preserve the built-in mail designs
and the separate online bulletin repository.

## Personal reusable templates

Use the always-visible **내 템플릿 저장 · 관리** section below the export tools.
The former guidance/code section is no longer displayed. If automatic clipboard
copying fails, a selected read-only code field appears only in the export area.

- Enter a name and save the current mail as a new snapshot.
- Select a saved template and load an independent copy. Editing that copy does not
  overwrite the saved template. Save another named copy to keep further changes.
- Rename or delete personal templates. Loading asks before replacing the current
  work; deletion asks for confirmation and does not delete the current mail.
- Built-in templates remain separate and cannot be overwritten by this feature.
- Legacy user templates remain available, marked **이전 저장본**.

Personal templates use this site's local browser storage, not a server database.
They are available only in the same browser profile and site origin. They do not
sync between computers, browsers, or a downloaded HTML file and the online site.
Clearing site data removes them. Private browsing may discard them when closed.
Large or numerous photos may exceed the browser's storage quota. Failed saves
show an error and preserve both existing templates and the current editor data.
The separate existing automatic current-work draft still uses IndexedDB.

## Maintenance

`personal-templates.js` is the editable source of the personal-template feature.
Run `npm run bundle` after changing it to update its marked section in `index.html`.
The delivered HTML remains fully self-contained. There are no new production
network requests, libraries, build services, JSON-file controls, or accounts.

New templates each have their own versioned localStorage key. This avoids
rewriting unrelated templates from another tab. Mutations reread records and reject
stale changes; Web Locks coordinate them where supported. Legacy records remain in
the original catalog map, with only the selected item changed by rename/delete.
Unrecognized or corrupt records are never automatically overwritten or deleted.

## Tests

Node 24 or newer, Python 3:

```sh
npm ci
npm run bundle
npm test
```

The tests cover snapshot isolation, all template families, rich text, card links,
header and theme settings, save/reload, cancel paths, rename/delete, legacy records,
duplicate and invalid names, storage errors, stale-tab conflicts, and pending Korean
IME text. Forty-three canonical template/header exports are checked against the
pre-change output hashes from commit `488639d0434fc126a3ec4a633df41ab0ec81d508`.

These are JSDOM and simulated IndexedDB integration tests, not real browser layout
or mail-client tests. Desktop/mobile visual verification is still recommended.
The personal-template controls are responsive and stay in the existing scrollable
left menu; they are not included in exported email HTML.

## Publication

The feature was prepared on a local branch only. Do not push to production or
publish until deployment is separately requested. No workflow was added.
