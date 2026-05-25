import re, pathlib, json, subprocess
root = pathlib.Path('c:/xampp/htdocs/agro_sense')
text = root.joinpath('public/index.html').read_text(encoding='utf-8')
scripts = re.findall(r'<script>(.*?)</script>', text, re.S)
print('scripts=', len(scripts))
for i, script in enumerate(scripts, 1):
    cmd = ['node', '-e', 'const vm=require("vm"); vm.createScript(' + json.dumps(script) + ');']
    p = subprocess.run(cmd, capture_output=True, text=True)
    print('script', i, 'code', p.returncode)
    if p.stderr:
        print('stderr', p.stderr)
