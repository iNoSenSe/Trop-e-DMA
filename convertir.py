import pandas as pd
import json
import re
import unicodedata

EXCEL_FILE = "palmares.xlsx"  # ton fichier

# mots-clés qui indiquent la finale, peu importe l'orthographe/accents
FINAL_TOKENS = {"finale", "finales", "finale nationale", "finales nationales"}

def strip_accents(s):
    if s is None:
        return None
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s)) if not unicodedata.combining(c))

def norm_col(name):
    """normalise un en-tête de colonne : minuscule, sans accent, sans espaces"""
    if name is None:
        return None
    n = strip_accents(name).lower()
    n = re.sub(r'\s+', '', n)  # supprime espaces
    return n

def is_finale(v):
    if not isinstance(v, str):
        return False
    txt = strip_accents(v).lower().strip()
    return txt in FINAL_TOKENS

def to_int_or_none(x):
    try:
        if pd.isna(x):
            return None
        return int(float(x))
    except Exception:
        return None

def extract_int(s):
    """extrait le premier entier d'une chaine, ex. 'Niveau 5' -> 5"""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    if isinstance(s, (int, float)) and not pd.isna(s):
        try:
            return int(float(s))
        except Exception:
            return None
    m = re.search(r'(\d+)', str(s))
    return int(m.group(1)) if m else None

def to_str_or_none(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    s = str(x).strip()
    return s if s else None

def main():
    # Lis TOUTES les feuilles et concatène
    xls = pd.read_excel(EXCEL_FILE, sheet_name=None)
    if not xls:
        raise RuntimeError("Aucune feuille trouvée dans le fichier Excel.")

    frames = []
    for sheet, df in xls.items():
        # normalise les en-têtes
        df = df.rename(columns={col: norm_col(col) for col in df.columns})
        frames.append(df)

    df_all = pd.concat(frames, ignore_index=True)

    # remplace NaN par None
    df_all = df_all.astype(object).where(pd.notna(df_all), None)

    # on accepte 'annee' OU 'année' normalisé -> 'annee' après norm_col
    # mêmes pour: candidat, ville, niveau, distinction, professeur, rang
    entries = []
    for _, r in df_all.iterrows():
        annee = to_int_or_none(r.get('annee'))
        ville  = to_str_or_none(r.get('ville'))
        candidat = to_str_or_none(r.get('candidat'))
        distinction = to_str_or_none(r.get('distinction'))
        professeur = to_str_or_none(r.get('professeur'))

        # niveau: on essaie d'extraire un entier, sinon on garde la chaine
        niveau_num = extract_int(r.get('niveau'))
        niveau_val = niveau_num if niveau_num is not None else to_str_or_none(r.get('niveau'))

        rang = to_int_or_none(r.get('rang'))

        # détection finale
        finale_flag = is_finale(ville)
        if finale_flag:
            ville = "Finales Nationales"

        rec = {
            "annee": annee,
            "ville": ville,
            "candidat": candidat,
            "niveau": niveau_val,
            "distinction": distinction,
            "professeur": professeur,
            "rang": rang,
            "finale": finale_flag,
        }

        # enlève les None (optionnel)
        rec = {k: v for k, v in rec.items() if v is not None}

        # on garde seulement les lignes avec annee + candidat
        if rec.get("annee") and rec.get("candidat"):
            entries.append(rec)

    out = {"entries": entries}

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, allow_nan=False)

    print(f"✅ data.json généré avec {len(entries)} lignes (entries).")

if __name__ == "__main__":
    main()
