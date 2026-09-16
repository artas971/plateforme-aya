with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.splitlines()
cleaned_lines = ['const express = require("express");']
for line in lines:
    if 'const express = require' in line:
        continue
    cleaned_lines.append(line)

with open('server.js', 'w', encoding='utf-8') as out:
    out.write('\n'.join(cleaned_lines))

print("CLEANED EXPRESS DUPLICATES SUCCESSFULLY!")
