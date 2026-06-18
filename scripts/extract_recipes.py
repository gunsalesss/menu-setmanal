"""Parse the docx recipe books into structured JSON.
Heuristic parser: a recipe starts at a Title line, followed by an
'Ingredients' block and a 'Passos'/'Preparacio' block. Output is a
best-effort draft that the user can then hand-edit.
"""
import zipfile, re, json, sys, unicodedata, os

def docx_lines(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
    xml = re.sub(r'</w:p>', '\n', xml)
    txt = re.sub(r'<[^>]+>', '', xml)
    txt = (txt.replace('&amp;', '&').replace('&lt;', '<')
              .replace('&gt;', '>').replace('&#39;', "'"))
    lines = [l.strip() for l in txt.split('\n')]
    # drop pure-number lines (stray drawing ids) and empties
    out = []
    for l in lines:
        if not l:
            out.append('')
            continue
        if re.fullmatch(r'[\d\s]+', l):  # junk numeric ids
            continue
        out.append(l)
    return out

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s[:48]

ING_HDR = re.compile(r'^ingredients', re.I)
STEP_HDR = re.compile(r'^(passos|preparaci|elaboraci)', re.I)
RACIONS = re.compile(r'(\d+)\s*(racions|persones|pax)', re.I)

def is_title(line, prev_blank):
    # A title: short-ish, starts uppercase letter, not a header keyword,
    # follows a blank line, doesn't end with ':' and isn't a list item.
    if not line or len(line) > 70:
        return False
    if ING_HDR.match(line) or STEP_HDR.match(line):
        return False
    if line.endswith(':'):
        return False
    if line[0] in '-•0123456789':
        return False
    return prev_blank and line[0].isupper()

def parse(path, season):
    lines = docx_lines(path)
    recipes = []
    i = 0
    prev_blank = True
    cur = None
    section = None  # 'ing' | 'steps'
    def flush():
        nonlocal cur
        if cur and (cur['ingredients'] or cur['steps']):
            recipes.append(cur)
        cur = None
    while i < len(lines):
        line = lines[i]
        if is_title(line, prev_blank) and not ING_HDR.match(line):
            # look ahead: only treat as recipe title if an ingredients or
            # steps header shows up within the next few lines
            window = '\n'.join(lines[i+1:i+8])
            if ING_HDR.search(window) or STEP_HDR.search(window) or len(line.split()) <= 8:
                flush()
                cur = {'id': slug(line) or f'recipe-{len(recipes)}',
                       'name': line, 'seasons': [season], 'slots': [],
                       'servingsBase': 2, 'tags': [], 'ingredients': [],
                       'steps': [], 'raw': []}
                section = None
                prev_blank = (line == '')
                i += 1
                continue
        if cur:
            if ING_HDR.match(line):
                section = 'ing'; i += 1; prev_blank = False; continue
            if STEP_HDR.match(line):
                section = 'steps'; i += 1; prev_blank = False; continue
            m = RACIONS.search(line)
            if m and section == 'ing':
                cur['servingsBase'] = int(m.group(1))
                prev_blank = (line == ''); i += 1; continue
            if line:
                if section == 'ing':
                    cur['ingredients'].append(line)
                elif section == 'steps':
                    cur['steps'].append(line)
                else:
                    cur['raw'].append(line)
        prev_blank = (line == '')
        i += 1
    flush()
    return recipes

if __name__ == '__main__':
    base = '/Users/adria.gonzalez/Downloads'
    out = []
    for fn, season in [('Receptes Estiu 2025.docx', 'estiu'),
                       ('Receptes Tardor 2025.docx', 'tardor')]:
        out += parse(os.path.join(base, fn), season)
    os.makedirs('/Users/adria.gonzalez/menu-setmanal/data', exist_ok=True)
    with open('/Users/adria.gonzalez/menu-setmanal/data/recipes.draft.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'Extracted {len(out)} recipe drafts')
    for r in out:
        print(f"  - {r['name']}  (ing:{len(r['ingredients'])} steps:{len(r['steps'])})")
