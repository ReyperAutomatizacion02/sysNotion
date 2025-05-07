// src/App.jsx

// *** 1. Importaciones de React, ReactFlow, Dagre, Datos y Estilos ***
import React, { useState, memo, useMemo, useEffect } from "react"; // Importa useEffect
import ReactFlow, {
  Background, // Fondo (puntos, rejilla)
  Controls, // Botones de control (zoom, centrado)
  MiniMap, // Miniatura de navegación
  MarkerType, // Tipos de flecha/marcador
  Handle, // Puntos de conexión en nodos
  Position, // Posiciones de los handles (Top, Bottom, Left, Right)
  useNodesState, // Hook para gestionar el estado de los nodos en ReactFlow
  useEdgesState, // Hook para gestionar el estado de las aristas en ReactFlow
  // Importaciones para el componente de arista personalizada:
  // BaseEdge, EdgeLabelRenderer, getSmoothStepPath
  // -> Estas ahora se importan DENTRO del componente ParallelSmoothstepEdge.jsx
} from "reactflow";

// Importa la librería Dagre para el layout automático
import dagre from '@dagrejs/dagre';

// Importa el archivo JSON con los datos de Notion.
// ASEGÚRATE DE QUE ESTA RUTA Y NOMBRE DE ARCHIVO COINCIDAN CON TU ARCHIVO JSON EN src/
import notionData from "./bd_con_schema_y_relaciones.json";

// *** Importa el COMPONENTE de Arista Personalizada desde su archivo ***
import ParallelSmoothstepEdge from "./ParallelSmoothstepEdge";

// *** Importa los archivos CSS para el formato ***
import './DetailsPanel.css'; // Estilos para el panel lateral de detalles
import './Node.css';         // Estilos para el nodo personalizado (CollapsibleEntityNode)
import './Graph.css';         // Estilos para el contenedor del gráfico y efectos globales/resaltado


// *** 2. Definiciones de Constantes y Utilidades FUERA del componente principal (App) ***
//    Estas funciones y constantes se definen una sola vez. No acceden directamente
//    al estado de React del componente App (ej. useState), por lo que se pueden
//    definir de forma segura a este nivel.

// Paleta de colores - Usada para asignar colores a los nodos y sus aristas salientes.
// Elige colores que te gusten. Hay 10 aquí, se ciclarán si tienes más de 10 DBs.
const colorsPalette = [
  "#ef4444", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6",
  "#8b5cf6", "#6366f1", "#ec4899", "#d946ef", "#a3a3a3",
];


/**
 * Función para aplicar el layout de Dagre a un conjunto de nodos y aristas.
 * CREA una nueva instancia del grafo Dagre cada vez que se llama.
 * Calcula las posiciones (x, y) de los nodos basadas en la estructura del grafo.
 * Retorna los nodos con las posiciones calculadas y las aristas originales.
 * @param {Array<Object>} nodes - Array de objetos nodo en formato ReactFlow (sin posición necesaria).
 * @param {Array<Object>} edges - Array de objetos arista en formato ReactFlow.
 * @param {string} [direction='LR'] - Dirección del layout ('LR' para Left-Right, 'TB' para Top-Bottom).
 * @returns {{layoutedNodes: Array<Object>, edges: Array<Object>}} - Objetos nodo con posiciones añadidas y aristas originales.
 */
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  // *** Crear una NUEVA instancia del grafo Dagre para este cálculo específico ***
  // La instancia debe ser dirigida (directed: true) para que el algoritmo jerárquico funcione correctamente.
  // setDefaultEdgeLabel es una convención, no afecta el layout.
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  // Configura las opciones del layout de Dagre.
  // rankdir: Dirección del layout (LR, TB).
  // nodesep: Espacio mínimo entre nodos dentro del mismo rank (fila/columna).
  // ranksep: Espacio mínimo entre ranks.
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150, directed: true }); // Ajusta los valores de espaciado si es necesario


  // Agrega nodos a la instancia *actual* del grafo Dagre.
  // Dagre necesita las dimensiones de los nodos para calcular el layout.
  // Usamos dimensiones aproximadas constantes basadas en el CSS del nodo colapsado.
  nodes.forEach((node) => {
      const nodeWidth = 230; // Estimación del ancho mínimo del nodo desde Node.css
      const nodeHeight = 120; // Estimación de la altura inicial del nodo colapsado

      // Añadir el nodo a la instancia *actual* de dagreGraph con sus dimensiones.
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Agrega aristas a la instancia *actual* del grafo Dagre.
  // Solo necesita los IDs de origen y destino para definir las conexiones.
  edges.forEach((edge) => {
     // Verificar que los nodos de origen y destino de la arista existen en el grafo que estamos construyendo.
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
        // Añadir la arista (borde) al grafo Dagre.
        dagreGraph.setEdge(edge.source, edge.target);
    } else {
        // Log si una arista no puede ser añadida a Dagre (generalmente si sus nodos relacionados faltan).
        // Esto ya se advierte en processNotionDataForReactFlow, pero es una doble verificación.
        // console.warn(`Saltando arista en Dagre (nodos no encontrados): ID ${edge.id} entre ${edge.source} y ${edge.target}.`);
    }
  });

  try {
     // *** Ejecuta el algoritmo de layout de Dagre ***
     // Este es el paso donde Dagre calcula las coordenadas (x, y) para cada nodo.
     dagre.layout(dagreGraph);
     // console.log("Dagre Graph Layout Result:", dagreGraph); // Log del resultado del layout si debugueas
  } catch (error) {
     console.error("Error aplicando layout de Dagre:", error);
     // Si el layout falla, retornamos los nodos originales sin modificar sus posiciones
     // y las aristas. Esto evita que la aplicación se rompa, aunque el gráfico no tendrá layout.
     return { layoutedNodes: nodes, edges: edges }; // Fallback
  }


  // *** Actualiza las posiciones de los nodos originales con las posiciones calculadas por Dagre ***
  // Iteramos sobre los nodos originales (los que vienen de ReactFlow) y añadimos/actualizamos su propiedad 'position'.
  const layoutedNodes = nodes.map((node) => {
    // Obtiene la información calculada por Dagre para este nodo (contiene x, y, width, height).
    const nodeWithPosition = dagreGraph.node(node.id);

     // Si Dagre no calculó una posición para este nodo específico (raro si se añadió correctamente),
     // le asignamos una posición por defecto (ej. 0,0).
    if (!nodeWithPosition || typeof nodeWithPosition.x === 'undefined' || typeof nodeWithPosition.y === 'undefined') {
       console.warn(`Dagre no calculó la posición para el nodo ID: ${node.id}. Usando posición por defecto (0,0).`);
       return { ...node, position: { x: 0, y: 0 } }; // Devuelve el nodo original con pos por defecto
    }

    // Dagre calcula las posiciones (x, y) refiriéndose al CENTRO de cada nodo.
    // React Flow posiciona los nodos usando la esquina SUPERIOR IZQUIERDA.
    // Ajustamos la posición calculada por Dagre restando la mitad del tamaño del nodo
    // para convertir la coordenada del centro a la coordenada de la esquina superior izquierda.
    const newNode = {
        ...node, // Copia todas las propiedades originales del nodo de ReactFlow
        position: {
            x: nodeWithPosition.x - nodeWithPosition.width / 2,
            y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
        // Puedes añadir otras propiedades aquí, ej: deshabilitar arrastre después del layout
        // draggable: false,
    };

    return newNode; // Devuelve el nuevo objeto nodo con la posición actualizada
  });

  // Retornamos los nodos CON LAS POSICIONES calculadas y las aristas originales.
  // Las aristas no se modifican en este proceso de layout; solo se usan para definir la estructura del grafo en Dagre.
  return { layoutedNodes: layoutedNodes, edges: edges }; // Renombramos 'edges' para claridad al retornar
};


/**
 * Componente de Nodo Personalizado (CollapsibleEntityNode).
 * Se define una sola vez, fuera del componente App.
 * Muestra el título de la base de datos y los detalles del esquema (PK, TIMESTAMP, ATRIBUTOS).
 * Permite colapsar/expandir las secciones de detalle.
 * Está estilizado usando clases CSS definidas en Node.css.
 * @param {Object} data - El objeto 'data' pasado a este nodo por ReactFlow, contiene label, color, keys, timestamps, fields.
 * @returns {JSX.Element} - El elemento div que representa el nodo en el gráfico.
 */
const CollapsibleEntityNode = memo(({ data }) => {
  // Estado local para controlar si el nodo está colapsado o expandido
  const [collapsed, setCollapsed] = useState(true);
  // Función para alternar el estado colapsado
  const toggle = () => setCollapsed(!collapsed);

  // Estilo inline para el color de borde, ya que es dinámico para cada nodo (basado en data.color).
  const borderStyle = {
    borderColor: data.color,
  };

  // Obtener los datos del esquema del objeto 'data' pasado al nodo, con valores por defecto vacíos.
  const keys = data.keys || []; // Lista de nombres de propiedades marcadas como PK
  const timestamps = data.timestamps || []; // Lista de nombres de propiedades marcadas como Timestamp
  const fields = data.fields || []; // Lista de nombres de otras propiedades/atributos


  // El className principal para el contenedor del nodo, definido en Node.css
  const nodeContainerClass = "entity-node-container";
  // Nota: React Flow añade automáticamente otras clases como 'react-flow__node react-flow__node-<your-type>'
  // Podemos añadir clases condicionales si lo necesitamos, ej: para estilos de hover/seleccion, si no se aplican via className global.
  // const nodeContainerClass = `entity-node-container ${data.isHighlighted ? 'is-highlighted' : ''}`; // Ejemplo si pasas isHighlighted en data


  return (
    // Contenedor principal del nodo. Usa la clase de Node.css y el estilo de borde dinámico.
    <div className={nodeContainerClass} style={borderStyle}>
      {/* Handles (puntos de conexión invisibles) para que ReactFlow dibuje las aristas hacia/desde este nodo. */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} /> {/* Handle para aristas entrantes */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} /> {/* Handle para aristas salientes */}

      {/* Cabecera del nodo: Muestra el título de la Base de Datos y un control para colapsar/expandir. Es clickable. */}
      {/* Aplica la clase de cabecera definida en Node.css */}
      <div className="entity-node-header" onClick={toggle}>
        {/* El título de la base de datos. El truncamiento si es largo se maneja en el CSS. */}
        <span>{data.label || 'Sin Título'}</span>
        {/* Control visual para alternar colapsado/expandido (+/-) */}
        <span>{collapsed ? "＋" : "－"}</span>
      </div>

      {/* Secciones de Propiedades: Muestran la lista de propiedades clasificadas. */}
      {/* Renderizan condicionalmente (solo si hay datos en esa categoría de esquema). */}
      {/* Cada sección tiene un div con la clase 'entity-node-section'. */}

      {keys.length > 0 && ( // Renderizar la sección PK solo si hay nombres de PK
         <div className="entity-node-section">
           {/* Título de la sección (PK) */}
           <div className="section-title">PK</div>
           {/* Lista de nombres de propiedades PK */}
           <ul>{keys.map((k) => ( <li key={k}>{k}</li> ))}</ul>
         </div>
      )}

      {timestamps.length > 0 && ( // Renderizar la sección TIMESTAMPS solo si hay nombres de Timestamp
         // Clase adicional 'timestamps' para esta sección, si se desea un estilo diferente (ej. color de texto)
         <div className="entity-node-section timestamps">
           <div className="section-title">TIMESTAMPS</div>
           <ul>{timestamps.map((t) => ( <li key={t}>{t}</li> ))}</ul>
         </div>
      )}

      {/* Renderizar la sección ATRIBUTOS solo si el nodo NO está colapsado Y hay campos/atributos */}
      {!collapsed && fields.length > 0 && (
        <div className="entity-node-section">
          <div className="section-title">ATRIBUTOS</div>
          <ul>{fields.map((f) => ( <li key={f}>{f}</li> ))}</ul>
        </div>
      )}

       {/* Puedes añadir aquí otras secciones o elementos si hay más datos en data */}
       {/* Por ejemplo, mostrar el tipo de propiedad, no solo el nombre. Esto requeriría modificar processNotionDataForReactFlow */}
       {/* para incluir el tipo en el array 'fields' o añadir otro array 'properties'. */}

    </div>
  );
});

// *** Definir los tipos de nodos personalizados que se pasan a ReactFlow ***
// Esto mapea nombres de tipos (ej. 'entity') a los componentes React que los renderizarán.
// Definido una sola vez a nivel global para optimización.
const nodeTypes = {
    entity: CollapsibleEntityNode // Mapea el tipo 'entity' a nuestro componente CollapsibleEntityNode
};

// Callback para actualizar las posiciones de las etiquetas y flechas
const onUpdateEdge = (edgeId, newPosition) => {
  setEdges((prevEdges) =>
    prevEdges.map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            data: {
              ...edge.data,
              labelX: newPosition.labelX,
              labelY: newPosition.labelY,
            },
          }
        : edge
    )
  );
};

// Pasar el callback onUpdateEdge al tipo de arista personalizada
const edgeTypes = {
  parallelSmoothstep: (props) => (
    <ParallelSmoothstepEdge {...props} onUpdateEdge={onUpdateEdge} />
  ),
};

/**
 * Helper para generar un objeto arista en el formato que ReactFlow espera.
 * Usado dentro de processNotionDataForReactFlow para construir los objetos arista iniciales.
 * Nota: La lógica de paralelismo y asignación de 'type'/'data'/'className' se maneja DESPUÉS
 * de llamar a processNotionDataForReactFlow, en el useMemo principal.
 */
const createArrowEdge = (id, source, target, label, color = '#999') => {
  return {
    id, // ID único de la arista
    source, // ID del nodo de origen
    target, // ID del nodo de destino
    label, // Etiqueta de texto para mostrar en la arista
    // Estilos base de la arista. El grosor/color de resaltado se manejará con CSS.
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 20, height: 20 }, // Configuración de la flecha al final
    // El 'type' de la arista ('parallelSmoothstep') se asignará MÁS TARDE en el useMemo.
    // El 'data' de la arista (para paralelismo) también se asignará MÁS TARDE.
  };
};


/**
 * Procesa los datos crudos extraídos de Notion (desde el JSON)
 * para convertirlos en el formato de arrays de nodos y aristas que necesita ReactFlow.
 * También clasifica las propiedades del esquema en categorías (PK, TIMESTAMPS, ATRIBUTOS).
 * ESTA FUNCIÓN NO CALCULA POSICIONES NI MANEJA EL PARALELISMO DIRECTAMENTE.
 * Solo parsea el JSON y crea los objetos base de nodos y aristas.
 * Se define una sola vez a nivel global.
 * @param {Array<Object>} data - El array de objetos de bases de datos tal como se lee del JSON.
 * @param {Array<string>} colors - La paleta de colores para asignar a los nodos.
 * @returns {{reactFlowNodes: Array<Object>, reactFlowEdges: Array<Object>}} - Arrays de nodos (sin pos) y aristas (sin tipo/data de paralelismo).
 */
const processNotionDataForReactFlow = (data, colors) => { // Recibe 'colors' como argumento
  const reactFlowNodes = [];
  const reactFlowEdges = [];
  // Mapa para buscar nodos rápidamente por ID (útil para verificar relaciones destino).
  const nodeMap = new Map();

  // --- Validar y Generar Objetos Nodo para ReactFlow ---
  // Asegurar que los datos cargados son un array.
  if (!Array.isArray(data)) {
      console.error("Error de formato: Los datos cargados de Notion NO son un array. Revisa tu script Python.", data);
      return { reactFlowNodes: [], reactFlowEdges: [] };
  }

  // Iterar sobre cada objeto de base de datos en el array 'data'.
  data.forEach((db, index) => {
    // Validar la estructura mínima del objeto DB según nuestro JSON modificado.
    if (!db || typeof db.id === 'undefined' || typeof db.titulo === 'undefined' || typeof db.propiedades_esquema === 'undefined' || typeof db.relaciones === 'undefined') {
        console.warn("Saltando objeto de base de datos malformado o incompleto en JSON:", db);
        // console.log("Objeto malformado detallado:", db); // Log para depuración
        return; // Saltar este elemento si no tiene la estructura básica esperada
    }
    const nodeId = db.id; // El ID único de Notion es perfecto como ID de nodo en ReactFlow.
    const nodeColor = colors[index % colors.length]; // Asignar color cíclicamente.

    // Crear el objeto nodo en el formato ReactFlow.
    // La propiedad 'position' se añadirá/calculará DESPUÉS por la función getLayoutedElements (usando Dagre).
    // La propiedad 'data' contiene la información a pasar a nuestro componente CollapsibleEntityNode.
    const newNode = {
      id: nodeId, // ID único del nodo (Notion DB ID)
      type: "entity", // Usa nuestro tipo de nodo personalizado. Esto le dice a ReactFlow que use CollapsibleEntityNode.
      // position se añade por Dagre.
      data: { // Datos pasados a CollapsibleEntityNode (disponibles como props.data)
        label: db.titulo || "Sin Título", // Título de la DB como etiqueta principal del nodo.
        color: nodeColor, // El color asignado (para el borde del nodo y las aristas salientes).
        // Poblar los arrays de esquema desde la clave 'propiedades_esquema' del JSON. Usamos [] si no existen.
        keys: db.propiedades_esquema.keys || [],
        timestamps: db.propiedades_esquema.timestamps || [],
        fields: db.propiedades_esquema.fields || [],
        // Puedes añadir aquí otros datos brutos o procesados si CollapsibleEntityNode o el panel de detalles los necesita.
        // rawNotionData: db, // Opcional: si quieres tener acceso a todo el objeto DB original.
      },
    };
    // Evitar añadir nodos duplicados si por alguna razón aparecen en los datos crudos.
     if (!nodeMap.has(nodeId)) {
       reactFlowNodes.push(newNode);
       nodeMap.set(nodeId, newNode); // Añadir el nodo al mapa para búsqueda rápida.
    } else {
        console.warn(`Saltando nodo duplicado encontrado en JSON con ID: ${nodeId} (Título: ${db.titulo || 'Desconocido'}). Asegúrate de que el script Python no duplica resultados.`);
    }

  });

  // --- Generar Objetos Arista para ReactFlow ---
  let edgeIndex = 0; // Contador para ayudar a crear IDs de aristas únicos.

  // Iterar sobre cada base de datos original en los datos crudos del JSON para encontrar sus relaciones salientes.
  if (Array.isArray(data)) { // Re-validar que 'data' es un array.
      data.forEach((sourceDb) => {
        // Validar el objeto fuente y que tiene una lista de relaciones que es un array.
        if (!sourceDb || typeof sourceDb.id === 'undefined' || !Array.isArray(sourceDb.relaciones)) {
             return; // Saltar si el objeto fuente o sus relaciones no son válidos.
        }
        const sourceNodeId = sourceDb.id; // El ID de la base de datos fuente.

        // Solo procesar relaciones si la base de datos fuente fue añadida como nodo en el paso anterior.
        if(nodeMap.has(sourceNodeId)){
            // Iterar sobre CADA objeto de relación dentro del array 'relaciones' de la base de datos fuente.
            sourceDb.relaciones
                // Filtrar relaciones inválidas o incompletas. Debe existir el objeto relación y el ID de la DB de destino.
                .filter(relation => relation
                    && relation.relacion_a_db_id // Asegura que existe el ID de la base de datos de destino de la relación.
                    // Opcional: && relation.relacion_a_db_id !== sourceNodeId // Filtra relaciones a sí misma si no las quieres.
                )
                .forEach((relation) => {
                  const targetNodeId = relation.relacion_a_db_id; // El ID de la base de datos destino de la relación.
                  const edgeLabel = relation.nombre_propiedad; // El nombre de la propiedad de relación (usado como label).

                   // Generar un ID único y robusto para la arista.
                   // Combinar IDs de origen/destino con un índice y una versión limpia del label.
                   const uniquePart = edgeLabel ? `-${edgeLabel.replace(/[^a-zA-Z0-9]/g, '')}` : '';
                   const edgeId = `e-${edgeIndex++}-${sourceNodeId}-to-${targetNodeId}${uniquePart}`;

                  // **Crucial**: Verificar que el NODO DESTINO (la base de datos destino de la relación) *también* existe en nuestro mapa de nodos procesados (extraídos del JSON).
                  // Si una relación apunta a una base de datos que no extrajimos, no podemos dibujar la arista a ella.
                  if (nodeMap.has(targetNodeId)) {
                    // Obtener el color asignado al nodo fuente para usarlo en la arista.
                    // Esto ya fue asignado y está en el objeto nodo dentro de nodeMap.
                    const sourceNodeColor = nodeMap.get(sourceNodeId).data.color;

                    // Crear el objeto arista usando el helper createArrowEdge.
                    const newEdge = createArrowEdge(
                      edgeId, sourceNodeId, targetNodeId, edgeLabel, sourceNodeColor
                    );

                    // Nota: El 'type' de la arista ('parallelSmoothstep') y el 'data' para el paralelismo
                    // { parallelIndex, numParallel } se asignarán MÁS TARDE en el useMemo principal.
                    // newEdge.type = 'parallelSmoothstep'; // NO hagas esto aquí, hazlo en useMemo.
                    // newEdge.data = { ... }; // NO hagas esto aquí, hazlo en useMemo después de calcular el paralelismo.


                    reactFlowEdges.push(newEdge); // Añadir la arista procesada al array final de aristas.
                  } /* else {
                     // Log de advertencia si una relación apunta a una DB no encontrada/extraída.
                     console.warn(`Relación ignorada: La base de datos destino con ID "${targetNodeId}" (desde "${sourceDb.titulo || sourceNodeId}" vía "${relation.nombre_propiedad || 'sin nombre'}") no fue encontrada/extraída. No se creará la arista en ReactFlow.`);
                  }*/
            });
        } /* else {
             // Este caso no debería ocurrir si sourceDb era válido y se intentó añadir como nodo,
             // pero puede ser útil si hay problemas con la generación inicial de nodos.
             // console.warn(`Nodo fuente con ID "${sourceNodeId}" para DB "${sourceDb.titulo || 'Desconocida'}" no encontrado en nodeMap al procesar relaciones. Asegúrate de que fue procesada como nodo.`);
        }*/
      });
   }

  // console.log("Resultado processNotionDataForReactFlow (nodos, aristas sin pos/paralelismo):", { reactFlowNodes, reactFlowEdges }); // Log antes de Dagre/Paralelismo
  return { reactFlowNodes, reactFlowEdges }; // Devuelve los arrays de nodos (sin pos) y aristas (sin tipo/data de paralelismo).
};


// *** 3. Componente principal de tu aplicación React (App) ***
//    Este es el componente funcional que se renderiza y maneja el estado y la UI general.
export default function App() {
  // *** Estado local del componente App ***
  // Estado para almacenar el nodo seleccionado (null si no hay selección). Usado para mostrar/ocultar el panel de detalles.
  const [selectedNode, setSelectedNode] = useState(null);
  // Estado para almacenar los IDs de los elementos (nodos y aristas) que deben ser resaltados (ej. al pasar el ratón).
  // Usamos un Set para búsquedas eficientes por ID (add, delete, has son rápidos).
  const [highlightedElements, setHighlightedElements] = useState(new Set());


  // *** useMemo Hook: Procesamiento Completo de Datos y Layout Automático ***
  //    Este hook es esencial. Contiene toda la lógica costosa de procesamiento de datos JSON,
  //    cálculo de paralelismo y aplicación del layout de Dagre.
  //    Se ejecuta SOLO cuando el componente App se monta por primera vez,
  //    o si sus dependencias (`notionData`, `colorsPalette`) cambian (en este caso, son constantes).
  //    Retorna los arrays de nodos y aristas YA PREPARADOS para ser usados por los hooks de estado de ReactFlow.
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    console.log("--- useMemo: Iniciando procesamiento de datos, cálculo de paralelismo y layout ---");
    // Paso 1: Cargar y procesar datos crudos del JSON.
    const { reactFlowNodes, reactFlowEdges } = processNotionDataForReactFlow(notionData, colorsPalette); // Llama a la función para obtener nodos y aristas base.
    console.log(`Paso 1 (Datos Crudos -> RF Objects) completo: Procesados ${reactFlowNodes.length} nodos y ${reactFlowEdges.length} aristas desde JSON.`);

    // *** PASO 1.5: Calcular indices y conteos para aristas paralelas y asignarles tipo personalizado y datos ***
    //    Iteramos sobre las aristas generadas en el Paso 1 y agrupamos las que comparten origen y destino.
    //    Luego, a cada arista en un grupo paralelo, le asignamos un índice, el total del grupo y el tipo de arista personalizada.
    const edgesGroupedByPair = {}; // Objeto para agrupar aristas por par sourceId-targetId. La clave será "sourceId-targetId".

    reactFlowEdges.forEach(edge => {
        // Crea una clave única para el par de nodos origen-destino de la arista.
        const pairKey = `${edge.source}-${edge.target}`;
        if (!edgesGroupedByPair[pairKey]) {
            edgesGroupedByPair[pairKey] = []; // Inicializa el array si es el primer arista de este par.
        }
        edgesGroupedByPair[pairKey].push(edge); // Añade la arista al grupo correspondiente.
    });

    const finalReactFlowEdges = []; // Array para las aristas con la información de paralelismo y tipo asignado.
    // Iterar sobre cada grupo de aristas que comparten el mismo par de nodos (source -> target).
    Object.values(edgesGroupedByPair).forEach(edgeGroup => {
        const numParallel = edgeGroup.length; // Número total de aristas en este grupo (el grado de paralelismo).
        // Iterar sobre cada arista DENTRO de este grupo.
        edgeGroup.forEach((edge, index) => {
            // *** AQUI ASIGNAMOS LOS DATOS ESPECIFICOS Y EL TIPO A CADA ARISTA ***
            // Esto lo hacemos ANTES de pasar las aristas a getLayoutedElements (para Dagre)
            // y ANTES de pasarlas a useEdgesState de ReactFlow.
            edge.data = { // Aseguramos que el objeto 'data' existe y añadimos/actualizamos propiedades.
                ...edge.data, // Copia datos existentes si ya tuviera algo (por si processNotionData los añadió).
                parallelIndex: index, // Índice (0, 1, 2, ...) dentro del grupo de aristas paralelas.
                numParallel: numParallel, // Conteo total de aristas en este grupo paralelo.
            };
            edge.type = 'parallelSmoothstep'; // *** Asigna el tipo de arista personalizada ***

            finalReactFlowEdges.push(edge); // Añade la arista (ahora modificada) al array final.
        });
    });

    console.log(`Paso 1.5 (Cálculo Paralelismo) completo: Calculado paralelismo e info asignada para ${finalReactFlowEdges.length} aristas.`);
     // Log para ver cómo quedaron las aristas con la info de paralelismo
     // console.log("Aristas después de cálculo de paralelismo:", finalReactFlowEdges);


    // *** Paso 2: Aplicar el layout automático con Dagre ***
    console.log("Paso 2 (Layout de Dagre): Aplicando layout...");
    // Llamamos a la función getLayoutedElements. Le pasamos:
    // - Los Nodos crudos (que processNotionDataFromReactFlow generó sin posición).
    // - Las Aristas FINALES (finalReactFlowEdges) que ya tienen el 'type' y 'data' para paralelismo.
    //   Dagre NO usa 'type' o 'data' de la arista para su layout, solo usa edge.source y edge.target.
    //   Pero es la lista de aristas completa y final que existe en el gráfico.
    const layouted = getLayoutedElements(reactFlowNodes, finalReactFlowEdges, 'LR'); // Pasamos reactFlowNodes y finalReactFlowEdges

    console.log(`✅ Procesamiento Completo (Datos -> RF Objects -> Paralelismo -> Layout): ${layouted.layoutedNodes.length} nodos con posición calculada y ${layouted.edges.length} aristas.`); // layouted.edges debería ser igual a finalReactFlowEdges

    // Retorna los nodos CON POSICIONES calculadas y las aristas (que ya tienen tipo/data de paralelismo y estilo base).
    // Estos arrays 'layoutedNodes' y 'layoutedEdges' serán los valores INICIALES para los hooks de estado de ReactFlow.
    return { layoutedNodes: layouted.layoutedNodes, layoutedEdges: layouted.edges };

  }, [notionData, colorsPalette]); // Dependencias del useMemo. Recalculará si notionData o colorsPalette cambian.


  // *** 4. Hooks de Estado de ReactFlow: Gestionan los elementos que se renderizan en el lienzo ***
  //    Estos hooks toman los arrays iniciales calculados en useMemo y manejan los cambios
  //    causados por la interacción del usuario (ej. arrastrar nodos) o por actualizaciones programáticas.
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes); // 'nodes': estado actual de los nodos. onNodesChange: handler para actualizar nodos.
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges); // 'edges': estado actual de las aristas. onEdgesChange: handler para actualizar aristas.


   // *** 5. useEffect Hook: Efectos secundarios (ej. logs, fetch de datos si fueran dinámicos) ***
   //    Se ejecuta después del primer render y en subsiguientes actualizaciones si las dependencias cambian.
   //    Usado aquí principalmente para loguear el estado inicial de los hooks de ReactFlow para verificación.
   useEffect(() => {
     console.log(`--- useEffect: Estado inicial de ReactFlow Hooks ---`);
     console.log(`ReactFlow Hooks - Nodos en estado: ${nodes.length}, Aristas en estado: ${edges.length}`);
     if (nodes.length === 0) {
         console.warn("⚠️ ReactFlow inicializado sin nodos. Verifica los logs anteriores.");
     }
      // Opcional: Loguear el contenido de los estados iniciales de nodos/aristas.
      // console.log("Nodos en estado ReactFlow:", nodes);
      // console.log("Aristas en estado ReactFlow:", edges);

   }, [nodes.length, edges.length]); // Dependencias del useEffect: Solo re-ejecutar si el número de nodos o aristas en el estado cambia.


   // *** 6. Handlers para Interactividad del Usuario (Click y Hover) ***
   //    Funciones que responden a eventos del usuario en el lienzo de ReactFlow.
   //    Estas funciones ACTUALIZAN EL ESTADO (selectedNode, highlightedElements),
   //    lo cual causa un re-renderizado del componente App, y los useMemo para los elementos
   //    con clases de resaltado reaccionan a ese cambio de estado.

   // Handler llamado cuando el usuario hace clic en un nodo.
   // 'event' es el evento del navegador, 'node' es el objeto nodo de ReactFlow clickeado.
   const onNodeClick = (event, node) => {
       console.log('Click en nodo:', node);
       // Actualizar el estado para almacenar el nodo clickeado. Esto mostrará el panel de detalles.
       setSelectedNode(node);
       // Al seleccionar un nodo, limpiamos cualquier resaltado de hover activo para no confundir.
       setHighlightedElements(new Set());
   };

   // Función para cerrar el panel de detalles. Llamada por el botón de cerrar en el panel o haciendo clic en el fondo oscuro.
   const closeDetails = () => {
       console.log('Cerrando panel de detalles.');
       // Limpia el estado 'selectedNode' para ocultar el panel.
       setSelectedNode(null);
        // Opcional: Si habías deshabilitado el hover mientras había selección,
        // ahora podrías limpiar cualquier resaltado residual si lo hubiera, o
        // permitir que el hover vuelva a funcionar.
   };

   // Handler llamado cuando el ratón entra en el área de un nodo. Usado para el efecto de resaltar elementos relacionados.
   const onNodeMouseEnter = (event, node) => {
      // Solo aplicamos resaltado de hover si NO hay un nodo seleccionado actualmente.
      if (selectedNode) return;

      // Set para almacenar los IDs de todos los elementos que deben ser resaltados: el nodo actual, sus aristas conectadas, y los nodos en el otro extremo de esas aristas.
      const elementsToHighlight = new Set([node.id]); // Añade el ID del nodo actual al Set.

      // Encontrar todas las aristas en el estado 'edges' (manejado por useEdgesState) que están conectadas a este nodo.
      // Una arista está conectada si su origen O su destino es el ID del nodo actual.
      const relatedEdges = edges.filter(edge =>
          edge.source === node.id || edge.target === node.id
      );

      // Iterar sobre las aristas relacionadas y añadir sus IDs y los IDs de los nodos conectados al Set de resaltado.
      relatedEdges.forEach(edge => {
          elementsToHighlight.add(edge.id); // Añade el ID de la arista relacionada.
          elementsToHighlight.add(edge.source); // Añade el ID del nodo fuente de la arista (será el nodo actual o uno relacionado).
          elementsToHighlight.add(edge.target); // Añade el ID del nodo destino de la arista (será el nodo actual o uno relacionado).
      });

      // Actualizar el estado 'highlightedElements' con el nuevo Set. Esto causa un re-renderizado.
      setHighlightedElements(elementsToHighlight);
      // console.log('Elementos resaltados al entrar en nodo:', elementsToHighlight);
   };

   // Handler llamado cuando el ratón sale del área de un nodo. Limpia el resaltado de hover.
   const onNodeMouseLeave = (event, node) => {
        // Solo limpiamos el resaltado si NO hay un nodo seleccionado (el panel está cerrado).
        if (selectedNode) return;
        // Limpia el estado 'highlightedElements' (estableciéndolo a un nuevo Set vacío). Esto quita el efecto visual.
       setHighlightedElements(new Set());
       // console.log('Resaltado de nodo limpiado al salir.');
   };

    // Handler llamado cuando el ratón entra en el área de una arista. Resalta la arista y sus nodos conectados.
    const onEdgeMouseEnter = (event, edge) => {
         // Solo aplicamos resaltado si NO hay un nodo seleccionado.
         if (selectedNode) return;
         // Crea un Set para los IDs a resaltar: la arista actual y los nodos que conecta (origen y destino).
         const elementsToHighlight = new Set([edge.id, edge.source, edge.target]);
         // Actualizar el estado 'highlightedElements'. Esto causa un re-renderizado.
         setHighlightedElements(elementsToHighlight);
         // console.log('Elementos resaltados al entrar en arista:', elementsToHighlight);
    };

    // Handler llamado cuando el ratón sale del área de una arista. Limpia el resaltado de hover.
    const onEdgeMouseLeave = (event, edge) => {
         // Solo limpiamos el resaltado si NO hay un nodo seleccionado.
         if (selectedNode) return;
        // Limpia el estado 'highlightedElements'.
        setHighlightedElements(new Set());
        // console.log('Resaltado de arista limpiado al salir.');
    };


   // *** 7. Procesamiento de Elementos ANTES de pasarlos a ReactFlow para Aplicar Estilos Condicionales (Resaltado) ***
    //    Usamos useMemo para crear nuevos arrays de nodos y aristas. Estos nuevos arrays
    //    son COPIAS de los arrays de estado ('nodes', 'edges') a los que se les ha añadido
    //    propiedades de estilo o clases CSS condicionalmente, basadas en si el elemento
    //    está en el Set 'highlightedElements'.
    //    ReactFlow es eficiente en detectar que son objetos diferentes pero con los mismos IDs
    //    y actualizar solo lo necesario.
    //    Estos useMemo se re-calculan SOLO cuando los arrays de estado ('nodes', 'edges')
    //    o el estado de resaltado ('highlightedElements') cambian.

    const nodesWithHighlight = useMemo(() => nodes.map(node => {
        // Determinar si el nodo actual debe ser resaltado verificando si su ID está en el Set.
        const isHighlighted = highlightedElements.has(node.id);
        return {
            ...node, // Copia todas las propiedades originales del nodo
            // *** APLICAR ESTILO DE RESALTADO CON CLASES CSS ***
            // Añadir la clase CSS 'is-highlighted' si debe ser resaltado.
            // Esta clase se define en Graph.css y contendrá las reglas visuales para resaltar el nodo.
            // La concatenamos con las clases existentes si el nodo ya tiene alguna.
            className: isHighlighted ? `${node.className || ''} is-highlighted` : node.className,
             // Note: ReactFlow añade automáticamente otras clases base al nodo (react-flow__node react-flow__node-entity).
             // Puedes usar selectores CSS más específicos en Graph.css (ej. .react-flow__node-entity.is-highlighted).
            // Opcional: Si hubieras pasado 'isHighlighted' como data, CollapsibleEntityNode podría usarla.
            // data: { ...node.data, isHighlighted: isHighlighted }
            // O si prefieres estilos inline, los aplicarías aquí.
            // style: isHighlighted ? { ...node.style, filter: 'brightness(1.1)' } : node.style, // Ejemplo de estilo inline
        };
    }), [nodes, highlightedElements]); // Dependencias: Re-calcular cuando el estado de 'nodes' o 'highlightedElements' cambie.

    const edgesWithHighlight = useMemo(() => edges.map(edge => {
        // Determinar si la arista o cualquiera de los nodos que conecta debe ser resaltado.
        // Si la arista o uno de sus nodos de origen/destino está en el Set, resaltamos la arista.
        const isHighlighted = highlightedElements.has(edge.id) || highlightedElements.has(edge.source) || highlightedElements.has(edge.target);
         return {
             ...edge, // Copia todas las propiedades originales de la arista
             // *** APLICAR ESTILO DE RESALTADO CON CLASES CSS ***
              // Añadir la clase CSS 'is-highlighted' si debe ser resaltada.
              // Esta clase se usará en Graph.css para estilizar el path SVG de la arista.
             className: isHighlighted ? `${edge.className || ''} is-highlighted` : edge.className,
              // Nota: El 'type' de la arista ('parallelSmoothstep') y el 'data' para paralelismo
              // { parallelIndex, numParallel } ya están en 'edge' porque los asignamos en el useMemo principal (Paso 1.5).
              // Si estuvieras usando estilos inline para color/grosor, los modificarías aquí.
             // style: isHighlighted
             //        ? { ...edge.style, strokeWidth: (edge.style?.strokeWidth || 2) + 1 } // Ejemplo de estilo inline
             //        : edge.style,
         };
    }), [edges, highlightedElements]); // Dependencias: Re-calcular cuando el estado de 'edges' o 'highlightedElements' cambie.


  // *** 8. Renderizado del componente ReactFlow y elementos adicionales (panel de detalles) ***
  //    Este es el JSX principal que se renderiza en el navegador.
  return (
    // Contenedor principal para el gráfico de ReactFlow y otros elementos de UI (ej. panel de detalles).
    // Usa 'position: relative' para que los elementos posicionados absolutamente dentro (modal, backdrop) funcionen correctamente.
    // Usa la clase 'react-flow-container' (definida en Graph.css) si necesitas estilos específicos para este div contenedor.
    <div className="react-flow-container" style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* *** El componente principal de ReactFlow *** */}
      <ReactFlow
        // Pasamos los arrays de nodos y aristas CON las propiedades de resaltado añadidas por los useMemo anteriores.
        nodes={nodesWithHighlight} // ReactFlow renderizará estos nodos.
        edges={edgesWithHighlight} // ReactFlow renderizará estas aristas, usando sus propiedades 'type' y 'data'.
        onNodesChange={onNodesChange} // Pasar los handlers para que ReactFlow pueda actualizar el estado 'nodes' al arrastrar, etc.
        onEdgesChange={onEdgesChange} // Pasar los handlers para que ReactFlow pueda actualizar el estado 'edges'.
        onNodeClick={onNodeClick} // Registrar nuestro handler para el evento de clic en nodos.
        // Registrar nuestros handlers para los eventos de pasar el ratón (hover) en nodos y aristas.
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={nodeTypes} // Registrar nuestros tipos de nodos personalizados (definido a nivel global).
        edgeTypes={edgeTypes} // Registrar nuestros tipos de aristas personalizados (definido a nivel global). Esto le dice a RF que use ParallelSmoothstepEdge.
        fitView // Prop para que el gráfico se ajuste y centre automáticamente al cargar/actualizar.
        fitViewOptions={{ padding: 0.2 }} // Opciones para fitView (añade un pequeño margen alrededor del contenido).
        // Otras props de interactividad opcionales:
        // zoomOnScroll={true}
        // panOnDrag={true}
        // nodesDraggable={true} // Por defecto TRUE si onNodesChange está presente
        // elementsSelectable={true} // Por defecto TRUE
        // panOnScroll={true}
      >
        {/* Elementos adicionales proporcionados por ReactFlow para funcionalidades comunes */}
        <Background variant="dots" gap={12} size={1} /> {/* Un fondo con puntos */}
        <MiniMap zoomable pannable /> {/* Mini mapa de navegación */}
        {/* Controles de UI (botones de zoom/centrado). showInteractive=false oculta íconos adicionales. */}
        <Controls showInteractive={false} />

         {/* Puedes añadir otros elementos o lógica visual DENTRO del <ReactFlow> wrapper si es necesario */}

      </ReactFlow>

      {/* *** Panel de Detalles del Nodo Seleccionado y su Fondo Oscuro (Backdrop) *** */}
      {/* Estos elementos se renderizan CONDICIONALMENTE, solo si 'selectedNode' no es null. */}

      {/* El backdrop oscuro: Ayuda a enfocar al usuario en el panel y sirve como área clickable para cerrar el panel. */}
      {selectedNode && (
          // Aplica la clase CSS 'details-overlay-backdrop' definida en DetailsPanel.css.
          <div className="details-overlay-backdrop" onClick={closeDetails}></div>
      )}

      {/* El panel de detalles propiamente dicho: Muestra información del nodo seleccionado. */}
      {selectedNode && (
          // Aplica la clase principal 'details-panel-overlay' definida en DetailsPanel.css.
          <div className="details-panel-overlay">
              {/* Título del panel, muestra el label del nodo. Usa clase CSS. */}
              <h4>Detalles: {selectedNode.data.label || 'Sin Título'}</h4>

              {/* Secciones de propiedades (PK, TIMESTAMPS, ATRIBUTOS). */}
              {/* Renderizan solo si hay datos en data.keys, data.timestamps, data.fields. */}
              {/* Usan clases CSS 'property-section', 'section-title', etc. definidas en DetailsPanel.css. */}
              {selectedNode.data.keys.length > 0 && (
                  <div className="property-section">
                      <strong>PK</strong> {/* El strong también puede ser estilizado con .property-section strong */}
                      <ul>{selectedNode.data.keys.map(k => <li key={k}>{k}</li>)}</ul> {/* Los li pueden ser estilizados con .property-section li */}
                  </div>
              )}
               {selectedNode.data.timestamps.length > 0 && (
                  <div className="property-section">
                      <strong>TIMESTAMPS</strong>
                      <ul>{selectedNode.data.timestamps.map(t => <li key={t}>{t}</li>)}</ul>
                  </div>
              )}
               {selectedNode.data.fields.length > 0 && (
                  <div className="property-section">
                      <strong>ATRIBUTOS</strong>
                      <ul>{selectedNode.data.fields.map(f => <li key={f}>{f}</li>)}</ul>
                  </div>
              )}

                {/* Sección opcional para mostrar el ID de Notion del nodo. */}
                {/* Usa la clase CSS 'node-id' definida en DetailsPanel.css. */}
                <div className="node-id">
                   ID: {selectedNode.id}
                </div>

              {/* Botón para cerrar el panel. Usa la clase CSS 'close-button'. */}
              <button className="close-button" onClick={closeDetails}>
                  Cerrar
              </button>
          </div>
      )}

    </div>
  );
}