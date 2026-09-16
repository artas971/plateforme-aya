with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

if not content.startswith("const express"):
    content = "const express = require('express');\n" + content

with open('server.js', 'w', encoding='utf-8') as out:
    out.write(content)

print("Added express require to top of server.js!")
