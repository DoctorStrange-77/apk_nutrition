from pathlib import Path
root=Path(r"C:\GitHub\apk_nutrition")

def replace(path, pairs):
    p=root/path
    s=p.read_text(encoding="utf-8")
    for old,new in pairs:
        if old not in s:
            print("MISSING", path, repr(old))
        s=s.replace(old,new)
    p.write_text(s,encoding="utf-8",newline="\n")

replace(Path("src/App.tsx"), [
    ("BUILDER NUTRITION","APP NUTRITION"),
    ("Imposta i macro, scegli il timing e crea automaticamente il tuo menu giornaliero.",
     "Imposta i macronutrienti, scegli il timing e crea automaticamente il tuo menu giornaliero."),
    ("Alimenti Builder, personali, barcode e ricette. Le ricette possono essere usate anche dal generatore automatico.",
     "Alimenti predefiniti, personali, acquisiti tramite barcode e ricette. Le ricette possono essere usate anche dal generatore automatico."),
])

replace(Path("src/components/SetupGuideCard.tsx"), [
    ("âœ“","✓"),
    ("â€¢","•"),
    ("Configura Builder in 3 passaggi","Configura App Nutrition in 3 passaggi"),
    ("Per creare automaticamente il menu servono prima i tuoi macro giornalieri e il timing dei pasti.",
     "Per creare automaticamente il menu, imposta prima i macronutrienti giornalieri e il timing dei pasti."),
    ("1. Imposta i macro di partenza","1. Imposta i macronutrienti di partenza"),
    ("2. Scegli il Timing","2. Scegli il timing"),
    ("Seleziona quando ti alleni e come distribuire i macro nei pasti.",
     "Seleziona quando ti alleni e come distribuire i macronutrienti nei pasti."),
    ("Builder userÃ  macro + timing per creare automaticamente la giornata.",
     "App Nutrition userà i macronutrienti impostati e il timing scelto per creare automaticamente la giornata."),
])

replace(Path("src/components/FoodReplacementModal.tsx"), [
    ("Dopo la scelta Builder riottimizza le grammature del pasto per restare il più vicino possibile al target.",
     "Dopo la scelta, App Nutrition riottimizza le grammature del pasto per restare il più vicino possibile al target."),
])

replace(Path("src/components/ProgressPanel.tsx"), [
    ("Nuovo target applicato. Builder aspetterà un nuovo check-in prima di proporre un’altra correzione.",
     "Nuovo target applicato. App Nutrition attenderà un nuovo check-in prima di proporre un’altra correzione."),
])

replace(Path("src/components/BetaAccessGate.tsx"), [
    ("App Nutrition 1.1.1 Beta","App Nutrition 1.1.2 Beta"),
])

replace(Path("package.json"), [
    ('"version": "1.1.1"','"version": "1.1.2"'),
])

replace(Path("public/sw.js"), [
    ("builder-nutrition-v110","app-nutrition-v112"),
])

print("PATCHED")
