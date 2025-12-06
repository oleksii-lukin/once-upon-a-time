import ast
import json

SEED_FILE = '/home/alukin/proj/demo/once-upon-a-time/onceuponatime-antigravity/scripts/generate_seed.py'

def extract_lists():
    with open(SEED_FILE, 'r') as f:
        try:
            tree = ast.parse(f.read())
        except Exception as e:
            print(f"Error parsing {SEED_FILE}: {e}")
            return {}
    
    data = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if target.id in ['protagonists', 'antagonists', 'settings', 'objects', 'catalysts', 'traits', 'endings']:
                        items = []
                        if isinstance(node.value, ast.List):
                            for el in node.value.elts:
                                if isinstance(el, ast.Tuple):
                                    consts = []
                                    for elt in el.elts:
                                        if isinstance(elt, ast.Constant):
                                            consts.append(elt.value)
                                        elif isinstance(elt, ast.Str):
                                            consts.append(elt.s)
                                    items.append(consts)
                        data[target.id] = items
    return data

if __name__ == "__main__":
    data = extract_lists()
    # Output minimal data (name, description) to save tokens
    simplified_data = {}
    for category, items in data.items():
        simplified_items = []
        for item in items:
            if len(item) >= 2:
                # Name, Description
                simplified_items.append((item[0], item[1]))
        simplified_data[category] = simplified_items
    
    print(json.dumps(simplified_data, indent=2))
