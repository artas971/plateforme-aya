with open('server_reconstructed.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

top_block = ''.join(lines[0:52])
rest_code = ''.join(lines[52:])

target = "app.post('/api/reply-to-aya'"
if target in rest_code:
    fixed_code = rest_code.replace(target, top_block + "\n\n" + target, 1)
else:
    fixed_code = rest_code + "\n\n" + top_block

with open('server.js', 'w', encoding='utf-8') as out:
    out.write(fixed_code)

print("SUCCESSFULLY FIXED server.js ORDER!")
