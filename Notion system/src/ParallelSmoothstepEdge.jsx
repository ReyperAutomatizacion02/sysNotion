// src/ParallelSmoothstepEdge.jsx

import React, { useState } from 'react';
// Importa los componentes y utilidades necesarios de ReactFlow
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

// Componente de Arista Personalizada
const ParallelSmoothstepEdge = ({
  id,
  sourceX, // Coordenada X del punto de conexión en el nodo fuente
  sourceY, // Coordenada Y del punto de conexión en el nodo fuente
  targetX, // Coordenada X del punto de conexión en el nodo destino
  targetY, // Coordenada Y del punto de conexión en el nodo destino
  sourcePosition, // Posición del handle fuente (Top, Bottom, Left, Right)
  targetPosition, // Posición del handle destino (Top, Bottom, Left, Right)
  style = {}, // Objeto de estilo pasado desde la prop 'style' de la arista (contiene color, grosor, etc.)
  label, // Etiqueta de texto de la arista
  labelStyle = {}, // Estilo para el contenedor del texto del label
  // Props relacionadas con el fondo del label, si se usan
  // labelShowBg = true, labelBgStyle = {}, labelBgPadding = [2, 4], labelBgBorderRadius = 2,
  markerEnd, // Configuración de la flecha al final de la arista
  data, // Nuestro objeto de datos pasado a la arista ({ parallelIndex, numParallel, ... })
  onUpdateEdge, // Callback para actualizar el estado global del gráfico
  // Puedes recibir otras props de ReactFlow aquí si las necesitas: selected, animated, etc.
  // className // Si aplicaste una clase al objeto arista (ej. 'is-highlighted')
}) => {
  const [labelPosition, setLabelPosition] = useState({}); // Guardar posiciones personalizadas de las etiquetas

  // Ajustar los eventos de arrastre para evitar interferencias con ReactFlow
  const handleDragStart = (event) => {
    event.stopPropagation(); // Evitar que el evento interfiera con ReactFlow
  };

  const handleDrag = (event) => {
    event.stopPropagation(); // Evitar que el evento interfiera con ReactFlow
  };

  // Ajustar la lógica para permitir que las relaciones sean completamente arrastrables
  const handleDragEnd = (event, edgeId) => {
    event.stopPropagation(); // Evitar interferencias con ReactFlow

    const newX = event.clientX;
    const newY = event.clientY;

    // Actualizar la posición de la etiqueta localmente
    setLabelPosition((prev) => ({
      ...prev,
      [edgeId]: { x: newX, y: newY },
    }));

    // Llamar al callback para actualizar el estado global del gráfico
    if (onUpdateEdge) {
      onUpdateEdge(edgeId, {
        labelX: newX,
        labelY: newY,
      });
    }
  };

  // Obtener la información de paralelismo del objeto data
  const isParallel = data?.numParallel > 1; // True si hay más de 1 arista paralela
  const parallelIndex = data?.parallelIndex || 0; // Índice de esta arista dentro del grupo (0-based)
  const numParallel = data?.numParallel || 1; // Conteo total de aristas en el grupo

  // *** Configurar el espaciado y el desplazamiento ***
  const spacing = 25; // Incrementar el espaciado para mayor separación

  let offsetX = 0; // Desplazamiento final en X
  let offsetY = 0; // Desplazamiento final en Y

  // Calcular el desplazamiento SOLO si hay aristas paralelas.
  if (isParallel) {
    // Calcula el 'punto medio' del grupo de aristas (ej: para 3 aristas (0, 1, 2), el centro está en el índice 1)
    const centerIndex = (numParallel - 1) / 2;
    // Calcula cuánto debe desplazarse esta arista particular desde la línea central imaginaria
    const offsetAmount = (parallelIndex - centerIndex) * spacing;

    // Determina si la arista es predominantemente horizontal o vertical basándose en la posición de los handles
    // (Esto funciona bien si los handles son Lados Izq/Der o Arr/Abajo)
    if (sourcePosition === 'left' || sourcePosition === 'right') {
      // Si la arista va de Izq a Der o Der a Izq, aplicamos el desplazamiento verticalmente (en Y)
      offsetY = offsetAmount;
    } else if (sourcePosition === 'top' || sourcePosition === 'bottom') {
      // Si la arista va de Arr a Abajo o Abajo a Arr, aplicamos el desplazamiento horizontalmente (en X)
      offsetX = offsetAmount;
    } else {
      // Para posiciones no estándar, aplicar un desplazamiento combinado
      offsetX = offsetAmount / Math.sqrt(2);
      offsetY = offsetAmount / Math.sqrt(2);
    }
     // Nota: Esta lógica es simplificada para handles Left/Right/Top/Bottom.
     // Aristas entre esquinas o diagonales requerirían una lógica de desplazamiento más compleja.
  }

  // *** Generar la ruta de la arista (path) usando getSmoothStepPath ***
  // Simplificar y asegurar la inicialización de labelX y labelY
  const [edgePath, defaultLabelX, defaultLabelY] = getSmoothStepPath({
    sourceX: sourceX + offsetX,
    sourceY: sourceY + offsetY,
    sourcePosition,
    targetX: targetX + offsetX,
    targetY: targetY + offsetY,
    targetPosition,
    borderRadius: style.borderRadius || 5,
  });

  // Obtener la posición de la etiqueta desde el estado global o usar la predeterminada
  const customLabelPosition = {
    x: data?.labelX ?? defaultLabelX,
    y: data?.labelY ?? defaultLabelY,
  };

  // *** Renderizar la arista (línea) y su label ***
  return (
    <>
      {/* BaseEdge es un componente helper de ReactFlow que toma el 'path' y dibuja la línea SVG */}
      <BaseEdge
        path={edgePath} // La ruta SVG calculada con el posible desplazamiento
        style={style}   // Aplica los estilos originales (color, grosor, etc.)
        markerEnd={markerEnd} // Aplica la configuración de la flecha
      />

      {/* Hacer que las aristas sean arrastrables */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(${customLabelPosition.x}px, ${customLabelPosition.y}px)`,
            pointerEvents: 'all',
            cursor: 'grab',
          }}
          className="nodrag nopan"
          draggable
          onDragStart={(event) => event.stopPropagation()} // Evitar interferencias
          onDrag={(event) => event.stopPropagation()} // Evitar interferencias
          onDragEnd={(event) => handleDragEnd(event, id)}
        >
          <div className="react-flow__edge-label">
            {label}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Exporta el componente de arista personalizada
export default ParallelSmoothstepEdge;