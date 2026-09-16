with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 0 to 347 and lines 400 to end
cleaned_lines = lines[:348] + lines[400:]

with open('server.js', 'w', encoding='utf-8') as out:
    out.writelines(cleaned_lines)

print("CLEANED DUPLICATE ROUTES SUCCESSFULLY!")
