"""Bundle the reviewed runtime into this repository's standalone HTML."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
page = root / 'index.html'
start = '// BEGIN PERSONAL TEMPLATES\n'
end = '// END PERSONAL TEMPLATES\n'
s = page.read_text()
runtime = start + (root / 'personal-templates.js').read_text() + end
if start in s:
    a = s.index(start)
    b = s.index(end, a) + len(end)
    s = s[:a] + runtime + s[b:]
else:
    marker = "newTemplate('program');initializeDraft();"
    assert s.count(marker) == 1
    s = s.replace(marker, runtime + '\n' + marker)
page.write_text(s)
