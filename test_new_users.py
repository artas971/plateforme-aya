import urllib.request
import json

def test_login(u, p):
    req = urllib.request.Request(
        'http://localhost:3000/api/login',
        data=json.dumps({'username': u, 'password': p}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    print(f'LOGIN RESULT FOR "{u}":', res.read().decode('utf-8'))

test_login('aya nurse', 'thebestnurse')
test_login('anais(idontcare)', "l'authentique")
