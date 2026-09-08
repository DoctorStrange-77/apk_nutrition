from pathlib import Path
root=Path(r"C:\GitHub\apk_nutrition")
paths=list((root/"src").rglob("*.ts"))+list((root/"src").rglob("*.tsx"))+[root/"index.html",root/"capacitor.config.ts"]
needles=("Builder Nutrition","Configura Builder","Builder user","Alimenti Builder","Dopo la scelta Builder","Builder aspetter")
bad=("Ã","â","�")
for p in paths:
    try:
        s=p.read_text(encoding="utf-8")
    except Exception:
        continue
    for i,line in enumerate(s.splitlines(),1):
        if any(x in line for x in needles) or any(x in line for x in bad):
            print(f"{p.relative_to(root)}:{i}:{line!r}")
