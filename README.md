# :star: Check our WebGA here -> [https://zoal.app/](https://zoal.app/)
>
# zoal-honeycomb (Previously xa-honeycomb)

>NOTE: I didn't test on Windows and Linux build is currently broken
>
>NOTE: UI is still WIP

## Supported Planes
> Note: unchecked are still in progress

- [x] A20N by toliss
- [x] A319 by toliss
- [x] A321 by toliss
- [x] A339 by toliss
- [x] A346 by toliss
- [x] B738 by Zibo
- [ ] B752 by FF
- [ ] B753 by FF
- [ ] B763 by FF
- [ ] B764 by FF
- [x] B772 by FF
- [x] B736/7/8/9 by Level Up
- [x] C172 by LR
- [ ] C172 by Airfoilabs
- [x] DH8D by FlyJSim
- [x] E55P
- [x] MD11 by Rotate
- [x] C750 by LR
- [x] DA42NG
- [x] DH8D
- [x] P28R VFA Arrow III
- [x] SR22
- [x] SF50     

## Install

1. Download `zoal-honeycombo.zip` from [Release Page](https://github.com/x-z7a/zoal-honeycomb/releases/latest).
    > NOTE: If you already use SkyScript for other plugins, you will only need the zoal-honeycomb folder in the unzip file's `apps` folder 
2. Drop the folder into XP's plugins folder

### Bravo Knobs Mapping
![image](https://github.com/user-attachments/assets/99477be6-2e40-4dc4-b57d-605c3d7457a0)

### Bravo AP Buttons Mapping
![image](https://github.com/user-attachments/assets/922bff1a-9255-4245-ab5c-fc93d8604262)


Above can be found by searching "honeycomb" after click `Edit`.


![image](https://github.com/user-attachments/assets/b0397f82-d074-4b14-aded-793a9c272b66)

## Roadmap
- [x] yaml based profile
- [x] Auto reconnect 
- [ ] GUI to help mapping dataref/cmds (WIP)
- [x] AP Buttons push/pull by single/double click

## Documentation
- Docs source: `docs/`
- Main page: `docs/index.md`
- Field reference: `docs/profile-fields.md`
- VitePress config: `docs/.vitepress/config.mts`
- Local docs dev: `cd docs && npm install && npm run docs:dev`
- Publish workflow: `.github/workflows/docs.yml`

### Custom domain for docs
Set repository variable `PAGES_CUSTOM_DOMAIN` (example: `docs.zoal.app`).
