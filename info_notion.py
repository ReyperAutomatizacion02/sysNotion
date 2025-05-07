from notion_client import Client
import json
import os
from dotenv import load_dotenv

load_dotenv() # Carga las variables del archivo .env

# Lee el token desde la variable de entorno
notion_token = os.getenv("NOTION_TOKEN")

if not notion_token:
    print("❌ Error: La variable de entorno NOTION_TOKEN no está configurada.")
    # Si estás seguro de que el token es este, puedes descomentar la siguiente línea SOLO PARA PRUEBAS LOCALES TEMPORALES Y NO LA DEJES ASÍ
    # notion_token = "ntn_349659861409o0DqnfCMem2ZnjE1LVPl4VYdW2kmHCdi7" # <-- Reemplaza con tu token si no usas .env
    # if not notion_token:
    #     print("❌ Error: TOKEN de Notion NO CONFIGURADO NI HARDCODEADO.")
    #     exit()
    exit() # Sale si el token no se encuentra


try:
    notion = Client(auth=notion_token)
    # Intentamos una pequeña consulta para verificar la autenticación
    # response = notion.search(query="test", page_size=1) # <-- Puedes probar con una query si quieres
    # print("✅ Conexión a la API de Notion exitosa.")

except Exception as e:
    print(f"❌ Error al conectar con la API de Notion: {e}")
    print("Por favor, verifica tu token y tu conexión a internet.")
    exit()


print("Buscando bases de datos en Notion...")
# Busca todas las bases de datos
try:
    response = notion.search(filter={"property": "object", "value": "database"})
    print(f"✅ Encontradas {len(response.get('results', []))} bases de datos.")
except Exception as e:
    print(f"❌ Error al buscar bases de datos: {e}")
    exit()


bases_de_datos = []

# Mapeo básico de tipos de Notion a categorías de nodos React
# Esto es una aproximación y puede que necesite ajuste basado en tu esquema real.
def categorize_property(prop_name, prop_type_obj):
    prop_type = prop_type_obj.get("type")
    # print(f"  Procesando propiedad: {prop_name} (Tipo: {prop_type})") # Log de depuración
    if prop_type == "title":
        return "key"
    elif prop_type in ["created_time", "last_edited_time"]:
        return "timestamp"
    # Las relaciones las tratamos por separado para las aristas,
    # pero el nombre de la propiedad de relación puede listarse como campo también si quieres
    elif prop_type == "relation":
        return "relation_prop" # Categoria especial para procesar relaciones
    # Otros tipos comunes como "text", "number", "select", "multi_select", "date", "url", etc.
    # y tipos más complejos como "formula", "rollup", "files" etc.
    else:
        return "field"


for result in response["results"]:
    db_id = result["id"]
    # Extraer el título
    titulo = "Sin título"
    title_data = result.get("title", [])
    # El título puede ser texto o estar vacío
    if title_data and title_data[0].get("type") == "text" and title_data[0].get("text"):
        titulo = title_data[0]["text"].get("content", "Sin título")
    # Alternativamente, si el título está en otra estructura, ajusta aquí

    print(f"Procesando '{titulo}' ({db_id})...")


    relaciones = []
    propiedades_esquema = {
        "keys": [],
        "timestamps": [],
        "fields": [],
        "relation_props": [] # Guardamos nombres de propiedades de relación aquí temporalmente
    }

    # Iterar sobre TODAS las propiedades (columnas) de la base de datos
    propiedades = result.get("properties", {})
    for nombre_propiedad, datos_propiedad in propiedades.items():
        categoria = categorize_property(nombre_propiedad, datos_propiedad)

        if categoria == "key":
             propiedades_esquema["keys"].append(nombre_propiedad)
        elif categoria == "timestamp":
             propiedades_esquema["timestamps"].append(nombre_propiedad)
        elif categoria == "field":
             # Aquí podrías añadir lógica para formatear cómo se muestra el campo
             propiedades_esquema["fields"].append(nombre_propiedad)
        elif categoria == "relation_prop":
            # Extraer información para la arista y guardar el nombre como una "propiedad de relación"
            if datos_propiedad.get("relation") and datos_propiedad["relation"].get("database_id"):
                 # Si es una relación de "dual_property", podría haber 2 database_id, elegimos el primero o ajustamos la lógica
                 # La mayoría de las relaciones simples tienen 1 database_id en relation["database_id"]
                 related_db_id = datos_propiedad["relation"]["database_id"] # O .get('database_id') con un default
                 relaciones.append({
                     "nombre_propiedad": nombre_propiedad,
                     "relacion_a_db_id": related_db_id
                 })
                 # Decidimos si listamos la propiedad de relación también como un campo normal:
                 # propiedades_esquema["fields"].append(f"{nombre_propiedad} (->)") # Opcional: Mostrar como campo regular


    # Si no se encontró una propiedad 'title', intenta identificar otra cosa como PK si hay convenciones.
    # Opcional: Si 'keys' está vacío después de buscar tipo 'title', puedes añadir lógicas de respaldo aquí.
    # if not propiedades_esquema["keys"]:
    #    # Lógica de respaldo, ej: buscar una prop con "ID" en el nombre

    bases_de_datos.append({
        "titulo": titulo,
        "id": db_id,
        "relaciones": relaciones, # Información para crear aristas
        "propiedades_esquema": propiedades_esquema # Información para mostrar en el nodo
    })

# Guardar en archivo JSON
output_filename = "bd_con_schema_y_relaciones.json" # Cambiar nombre de archivo para evitar sobrescribir el viejo
with open(output_filename, "w", encoding="utf-8") as f:
    json.dump(bases_de_datos, f, indent=4, ensure_ascii=False)

print(f"✅ Archivo '{output_filename}' guardado correctamente.")
print("Por favor, copia este archivo a la carpeta src/ de tu proyecto React.")