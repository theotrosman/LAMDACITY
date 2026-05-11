# Documento de Requisitos

## Introducción

Una aplicación web con estética lofi/pixel art que simula una ciudad viva. La ciudad contiene ciudadanos que nacen, crecen, se reproducen y mueren, siguiendo un ciclo de vida completo. Cada ciudadano toma decisiones de comportamiento (trabajar, comer, dormir, socializar, reproducirse) generadas mediante la API de Groq. La simulación corre en tiempo real en el navegador y muestra estadísticas de la población. El usuario puede ejercer influencia divina sobre la ciudad y sus ciudadanos a través de un chatbot integrado (Modo Dios), que interpreta órdenes en lenguaje natural y las ejecuta visualmente en la simulación mediante efectos procedurales generados en tiempo real.

## Glosario

- **Ciudad**: El entorno simulado compuesto por edificios, calles y zonas donde habitan los ciudadanos.
- **Ciudadano**: Entidad autónoma con ciclo de vida, atributos y comportamientos generados por IA.
- **Motor_de_Simulación**: Componente que gestiona el tiempo de simulación, el ciclo de vida de los ciudadanos y las interacciones entre ellos.
- **Motor_de_Renderizado**: Componente responsable de dibujar la ciudad y los ciudadanos en el canvas con estética lofi/pixel art.
- **Cliente_Groq**: Componente que se comunica con la API de Groq para generar decisiones de comportamiento de los ciudadanos y para interpretar órdenes del Modo_Dios.
- **Gestor_de_Población**: Componente que controla el nacimiento, reproducción y muerte de los ciudadanos.
- **Panel_de_Estadísticas**: Componente de UI que muestra métricas en tiempo real de la simulación.
- **Ciclo_de_Vida**: Secuencia de etapas por las que pasa un ciudadano: infancia, juventud, adultez y vejez.
- **Comportamiento**: Acción que realiza un ciudadano en un momento dado (trabajar, comer, dormir, socializar, reproducirse).
- **Tick**: Unidad mínima de tiempo de la simulación, equivalente a un intervalo configurable en milisegundos.
- **API_Key_Groq**: Clave de autenticación proporcionada por el usuario para acceder a la API de Groq.
- **Modo_Dios**: Funcionalidad que permite al usuario emitir órdenes en lenguaje natural sobre ciudadanos o el mundo, interpretadas y ejecutadas por la IA de Groq.
- **Chatbot_Divino**: Componente de UI que recibe las órdenes del usuario en el Modo_Dios y las envía al Cliente_Groq para su interpretación.
- **Orden_Divina**: Instrucción en lenguaje natural emitida por el usuario a través del Chatbot_Divino, que puede mencionar ciudadanos con el prefijo `@` o describir eventos globales.
- **Evento_Procedural**: Efecto visual generado dinámicamente en el canvas mediante píxeles y partículas, en respuesta a una Orden_Divina que no corresponde a ningún comportamiento preprogramado.
- **Generador_de_Efectos**: Componente que traduce la descripción de un Evento_Procedural en instrucciones de renderizado de píxeles y partículas en tiempo real.
- **Paleta_Lofi**: Conjunto de colores suaves, cálidos y desaturados usados por el Motor_de_Renderizado para lograr la estética lofi/pixel art.
- **Ambiente_Atmosférico**: Conjunto de elementos visuales y sonoros opcionales (lluvia suave, iluminación nocturna, música lofi) que refuerzan la estética lofi de la Ciudad.

---

## Requisitos

### Requisito 1: Renderizado de la Ciudad con Estética Lofi/Pixel Art

**User Story:** Como usuario, quiero ver una ciudad con estética lofi/pixel art en el navegador, para disfrutar de una experiencia visual calmada y acogedora mientras observo la simulación.

#### Criterios de Aceptación

1. THE Motor_de_Renderizado SHALL dibujar la ciudad en un elemento `<canvas>` HTML usando sprites de pixel art y la Paleta_Lofi, compuesta por colores suaves, cálidos y desaturados (máximo 32 colores en pantalla simultáneamente).
2. THE Motor_de_Renderizado SHALL representar al menos los siguientes elementos visuales: calles, edificios residenciales con ventanas iluminadas en tonos cálidos, edificios de trabajo, parques y ciudadanos como sprites animados de pixel art.
3. THE Motor_de_Renderizado SHALL aplicar una iluminación ambiental que simule un ambiente nocturno o de atardecer, con el cielo en tonos índigo, violeta o naranja suave según la hora de simulación.
4. THE Motor_de_Renderizado SHALL mostrar luces cálidas (amarillo suave, naranja) en las ventanas de los edificios residenciales durante el período nocturno de la simulación.
5. WHEN el tamaño de la ventana del navegador cambia, THE Motor_de_Renderizado SHALL ajustar el canvas manteniendo la proporción de aspecto original sin distorsionar los sprites.
6. THE Motor_de_Renderizado SHALL renderizar la ciudad a un mínimo de 30 fotogramas por segundo en navegadores modernos (Chrome, Firefox, Safari, Edge en sus versiones actuales).
7. WHEN un ciudadano cambia de comportamiento, THE Motor_de_Renderizado SHALL actualizar el sprite del ciudadano para reflejar visualmente la nueva acción dentro del siguiente Tick.
8. WHERE el usuario activa el Ambiente_Atmosférico de lluvia, THE Motor_de_Renderizado SHALL superponer una capa de partículas de lluvia suave sobre la ciudad sin reducir la tasa de fotogramas por debajo de 30 fps.
9. WHERE el usuario activa la música lofi de fondo, THE Motor_de_Renderizado SHALL reproducir una pista de audio lofi en bucle con volumen ajustable entre 0 y 100.

---

### Requisito 2: Generación Procedural de la Ciudad

**User Story:** Como usuario, quiero que la ciudad se genere automáticamente al iniciar la simulación, para tener un entorno único cada vez que la ejecuto.

#### Criterios de Aceptación

1. WHEN la simulación se inicia, THE Motor_de_Simulación SHALL generar una ciudad con una cuadrícula de entre 10×10 y 30×30 celdas, donde cada celda es una calle, un edificio o un parque.
2. THE Motor_de_Simulación SHALL garantizar que todos los edificios de la ciudad sean accesibles desde cualquier otro edificio a través de las calles generadas.
3. THE Motor_de_Simulación SHALL generar al menos un edificio residencial, un edificio de trabajo y un parque por cada 25 celdas de la cuadrícula.
4. WHERE el usuario configura una semilla de generación, THE Motor_de_Simulación SHALL producir exactamente la misma ciudad para la misma semilla.

---

### Requisito 3: Ciclo de Vida de los Ciudadanos

**User Story:** Como usuario, quiero que los ciudadanos nazcan, envejezcan, se reproduzcan y mueran, para observar una simulación de población realista.

#### Criterios de Aceptación

1. WHEN la simulación se inicia, THE Gestor_de_Población SHALL crear una población inicial de entre 10 y 50 ciudadanos con edades distribuidas aleatoriamente entre las etapas de infancia, juventud y adultez.
2. THE Gestor_de_Población SHALL asignar a cada ciudadano los atributos: identificador único, nombre, edad (en ticks), etapa del Ciclo_de_Vida, nivel de energía (0–100), nivel de hambre (0–100) y nivel de felicidad (0–100).
3. WHEN la edad de un ciudadano alcanza el umbral de la etapa siguiente del Ciclo_de_Vida, THE Gestor_de_Población SHALL actualizar la etapa del ciudadano de infancia a juventud, de juventud a adultez, o de adultez a vejez.
4. WHEN dos ciudadanos adultos con nivel de energía mayor a 70 y nivel de felicidad mayor a 60 se encuentran en la misma celda, THE Gestor_de_Población SHALL crear un nuevo ciudadano en la etapa de infancia con atributos heredados de ambos progenitores.
5. WHEN el nivel de energía de un ciudadano llega a 0 o su edad supera el umbral de vejez máxima, THE Gestor_de_Población SHALL eliminar al ciudadano de la simulación y registrar su muerte.
6. THE Gestor_de_Población SHALL mantener la población total entre 5 y 200 ciudadanos activos simultáneamente; IF la población cae por debajo de 5, THEN THE Gestor_de_Población SHALL generar ciudadanos nuevos hasta alcanzar 5.

---

### Requisito 4: Comportamientos de los Ciudadanos Generados por IA

**User Story:** Como usuario, quiero que los ciudadanos tomen decisiones de comportamiento usando la IA de Groq, para que sus acciones sean variadas, coherentes y sorprendentes.

#### Criterios de Aceptación

1. WHEN un ciudadano completa su comportamiento actual, THE Cliente_Groq SHALL enviar una solicitud a la API de Groq con el contexto del ciudadano (nombre, etapa del Ciclo_de_Vida, atributos actuales, comportamiento anterior y estado del entorno cercano) para obtener el siguiente comportamiento.
2. THE Cliente_Groq SHALL parsear la respuesta de la API de Groq en un objeto `Comportamiento` con los campos: acción (string), duración en ticks (número entero positivo) y descripción (string).
3. THE Cliente_Groq SHALL formatear el objeto `Comportamiento` de vuelta a texto legible para mostrarlo en la UI (pretty-print).
4. FOR ALL objetos `Comportamiento` válidos, parsear la respuesta de Groq y luego formatearla y volver a parsearla SHALL producir un objeto equivalente al original (propiedad round-trip).
5. IF la API de Groq devuelve un error o no responde en 5 segundos, THEN THE Cliente_Groq SHALL asignar al ciudadano un comportamiento predeterminado de la lista: [caminar, descansar, comer, socializar] sin interrumpir la simulación.
6. THE Motor_de_Simulación SHALL limitar las llamadas a la API de Groq a un máximo de 10 solicitudes por segundo para evitar superar los límites de la API.
7. WHEN un ciudadano recibe un comportamiento de tipo "trabajar", THE Motor_de_Simulación SHALL mover al ciudadano hacia el edificio de trabajo más cercano accesible.
8. WHEN un ciudadano recibe un comportamiento de tipo "comer", THE Motor_de_Simulación SHALL incrementar el nivel de energía del ciudadano en 20 puntos al completar la acción.
9. WHEN un ciudadano recibe un comportamiento de tipo "dormir", THE Motor_de_Simulación SHALL incrementar el nivel de energía del ciudadano en 40 puntos al completar la acción.
10. WHEN un ciudadano recibe un comportamiento de tipo "socializar", THE Motor_de_Simulación SHALL incrementar el nivel de felicidad de los ciudadanos involucrados en 15 puntos al completar la acción.

---

### Requisito 5: Configuración de la API de Groq

**User Story:** Como usuario, quiero introducir mi clave de API de Groq en la interfaz, para que la simulación pueda usar la IA sin exponer credenciales en el código.

#### Criterios de Aceptación

1. THE Panel_de_Estadísticas SHALL mostrar un campo de texto para que el usuario introduzca la API_Key_Groq antes de iniciar la simulación.
2. WHEN el usuario introduce la API_Key_Groq y pulsa "Iniciar Simulación", THE Motor_de_Simulación SHALL validar que el campo no está vacío antes de iniciar.
3. IF el usuario intenta iniciar la simulación sin introducir la API_Key_Groq, THEN THE Motor_de_Simulación SHALL mostrar un mensaje de error indicando que la clave es obligatoria y no iniciará la simulación.
4. THE Motor_de_Simulación SHALL almacenar la API_Key_Groq únicamente en memoria durante la sesión del navegador y no SHALL persistirla en almacenamiento local ni en cookies.
5. WHERE el usuario selecciona un modelo de Groq específico, THE Cliente_Groq SHALL usar ese modelo en todas las solicitudes; de lo contrario, THE Cliente_Groq SHALL usar el modelo `llama3-8b-8192` por defecto.

---

### Requisito 6: Panel de Estadísticas en Tiempo Real

**User Story:** Como usuario, quiero ver estadísticas de la simulación en tiempo real, para entender la dinámica de la población y el estado de la ciudad.

#### Criterios de Aceptación

1. THE Panel_de_Estadísticas SHALL mostrar las siguientes métricas actualizadas cada 5 ticks: población total, número de nacimientos acumulados, número de muertes acumuladas, distribución de ciudadanos por etapa del Ciclo_de_Vida y comportamiento más frecuente en el último minuto de simulación.
2. WHEN el usuario hace clic sobre un ciudadano en el canvas, THE Panel_de_Estadísticas SHALL mostrar los atributos detallados de ese ciudadano: nombre, edad, etapa, energía, hambre, felicidad y último comportamiento generado por Groq.
3. THE Panel_de_Estadísticas SHALL mostrar un registro de los últimos 20 comportamientos generados por la IA, con el nombre del ciudadano, la acción y la descripción.
4. THE Panel_de_Estadísticas SHALL mostrar el número de llamadas realizadas a la API de Groq y el número de errores de API en la sesión actual.

---

### Requisito 7: Controles de la Simulación

**User Story:** Como usuario, quiero poder pausar, reanudar y ajustar la velocidad de la simulación, para observar los comportamientos con el nivel de detalle que desee.

#### Criterios de Aceptación

1. THE Motor_de_Simulación SHALL exponer controles de: Iniciar, Pausar, Reanudar y Reiniciar la simulación.
2. WHEN el usuario pulsa "Pausar", THE Motor_de_Simulación SHALL detener el avance de los ticks y suspender todas las llamadas a la API de Groq hasta que el usuario pulse "Reanudar".
3. WHEN el usuario pulsa "Reiniciar", THE Motor_de_Simulación SHALL generar una nueva ciudad, eliminar todos los ciudadanos actuales y comenzar la simulación desde el estado inicial.
4. THE Motor_de_Simulación SHALL permitir al usuario ajustar la velocidad de simulación entre 1× y 10× mediante un control deslizante, donde 1× equivale a 1 tick por segundo y 10× equivale a 10 ticks por segundo.
5. WHILE la simulación está pausada, THE Motor_de_Renderizado SHALL continuar renderizando el estado actual de la ciudad sin avanzar la lógica de simulación.

---

### Requisito 8: Rendimiento y Compatibilidad

**User Story:** Como usuario, quiero que la simulación funcione de forma fluida en el navegador sin requerir instalación de software adicional, para acceder a ella fácilmente desde cualquier dispositivo.

#### Criterios de Aceptación

1. THE Motor_de_Simulación SHALL ejecutar la lógica de simulación en un Web Worker separado del hilo principal para no bloquear el renderizado.
2. THE Motor_de_Renderizado SHALL usar `requestAnimationFrame` para sincronizar el renderizado con la frecuencia de refresco del monitor.
3. WHEN la población supera 150 ciudadanos, THE Motor_de_Simulación SHALL agrupar las solicitudes a la API de Groq en lotes de hasta 5 ciudadanos por llamada para reducir la latencia total.
4. THE Motor_de_Simulación SHALL funcionar correctamente en las versiones actuales de Chrome, Firefox, Safari y Edge sin requerir plugins ni extensiones adicionales.
5. IF el navegador no soporta Web Workers, THEN THE Motor_de_Simulación SHALL ejecutar la lógica en el hilo principal y mostrar una advertencia al usuario indicando que el rendimiento puede verse afectado.

---

### Requisito 9: Chatbot de Modo Dios

**User Story:** Como usuario, quiero escribir órdenes en lenguaje natural dirigidas a ciudadanos o al mundo de la simulación, para ejercer influencia divina sobre lo que ocurre en la ciudad.

#### Criterios de Aceptación

1. THE Chatbot_Divino SHALL mostrar un panel de chat integrado en la interfaz con un campo de texto donde el usuario puede escribir Órdenes_Divinas en lenguaje natural.
2. THE Chatbot_Divino SHALL permitir al usuario mencionar ciudadanos específicos usando el prefijo `@` seguido del nombre del ciudadano (por ejemplo, `@Carlos`, `@María`).
3. WHEN el usuario envía una Orden_Divina, THE Cliente_Groq SHALL enviar la orden junto con el estado actual de los ciudadanos mencionados y el estado de la Ciudad a la API de Groq para su interpretación.
4. THE Cliente_Groq SHALL parsear la respuesta de la API de Groq en un objeto `Interpretación_Divina` con los campos: ciudadanos_afectados (lista de identificadores), tipo_de_efecto (string), descripción_visual (string), duración_en_ticks (número entero positivo) y es_preprogramado (booleano).
5. THE Cliente_Groq SHALL formatear el objeto `Interpretación_Divina` de vuelta a texto legible para mostrarlo en el historial del Chatbot_Divino (pretty-print).
6. FOR ALL objetos `Interpretación_Divina` válidos, parsear la respuesta de Groq y luego formatearla y volver a parsearla SHALL producir un objeto equivalente al original (propiedad round-trip).
7. WHEN la Orden_Divina menciona un ciudadano con `@nombre` y ese ciudadano existe en la simulación, THE Motor_de_Simulación SHALL aplicar el efecto interpretado directamente sobre ese ciudadano dentro de los 2 ticks siguientes a la recepción de la respuesta de Groq.
8. IF la Orden_Divina menciona un ciudadano con `@nombre` y ese ciudadano no existe en la simulación, THEN THE Chatbot_Divino SHALL mostrar un mensaje indicando que el ciudadano no fue encontrado y sugerirá los nombres más similares disponibles.
9. IF la API de Groq devuelve un error o no responde en 8 segundos al procesar una Orden_Divina, THEN THE Chatbot_Divino SHALL mostrar un mensaje de error al usuario sin interrumpir la simulación en curso.
10. THE Chatbot_Divino SHALL mostrar un historial de las últimas 50 Órdenes_Divinas emitidas, con la orden original, los ciudadanos afectados y el efecto aplicado.
11. WHILE la simulación está pausada, THE Chatbot_Divino SHALL aceptar Órdenes_Divinas y encolarlas para ejecutarlas cuando la simulación se reanude.

---

### Requisito 10: Eventos Dinámicos Generados Proceduralmente

**User Story:** Como usuario, quiero que las órdenes que no están preprogramadas generen efectos visuales únicos en tiempo real, para que cualquier cosa que imagine pueda verse reflejada en la ciudad.

#### Criterios de Aceptación

1. WHEN el objeto `Interpretación_Divina` recibido de Groq tiene el campo `es_preprogramado` igual a `false`, THE Generador_de_Efectos SHALL crear un Evento_Procedural basado en la `descripción_visual` proporcionada por Groq.
2. THE Generador_de_Efectos SHALL traducir la `descripción_visual` en un conjunto de instrucciones de renderizado que incluyan: posición en el canvas, forma de las partículas (círculo, cuadrado, píxel libre), colores de la Paleta_Lofi, velocidad de movimiento y duración en fotogramas.
3. WHEN un Evento_Procedural es creado, THE Motor_de_Renderizado SHALL renderizar el efecto visual superpuesto sobre la Ciudad en la posición indicada, sin interrumpir el renderizado de los ciudadanos ni de la Ciudad.
4. THE Generador_de_Efectos SHALL soportar al menos los siguientes tipos de efectos procedurales derivados de la descripción de Groq: explosión de partículas, lluvia de objetos, expansión radial de color, destello puntual y onda de choque circular.
5. WHEN un Evento_Procedural finaliza su duración en fotogramas, THE Motor_de_Renderizado SHALL eliminar el efecto del canvas y restaurar el estado visual previo de las celdas afectadas.
6. THE Generador_de_Efectos SHALL poder ejecutar hasta 5 Eventos_Procedurales simultáneos sin reducir la tasa de fotogramas por debajo de 30 fps.
7. IF la `descripción_visual` recibida de Groq no puede traducirse en instrucciones de renderizado válidas, THEN THE Generador_de_Efectos SHALL aplicar un efecto de destello puntual genérico en el centro de la Ciudad y registrar el fallo en el Panel_de_Estadísticas.

---

### Requisito 11: Influencia Divina sobre Ciudadanos y el Mundo

**User Story:** Como usuario, quiero poder decidir cualquier cosa sobre los ciudadanos o el entorno de la ciudad, para que la IA interprete mi intención y la ejecute de la forma más coherente posible en la simulación.

#### Criterios de Aceptación

1. WHEN la Orden_Divina describe una acción sobre uno o más ciudadanos (por ejemplo, "come una pizza gigante", "se enamoran", "se convierte en alcalde"), THE Motor_de_Simulación SHALL modificar los atributos del ciudadano afectado según la interpretación de Groq, incluyendo cambios en energía, felicidad, hambre, comportamiento actual o relaciones con otros ciudadanos.
2. WHEN la Orden_Divina describe un evento global sobre la Ciudad (por ejemplo, "cae un meteorito en el parque central", "comienza una tormenta", "aparece un arcoíris"), THE Motor_de_Simulación SHALL aplicar el efecto sobre las celdas de la Ciudad indicadas por Groq y activar el Evento_Procedural correspondiente.
3. THE Cliente_Groq SHALL incluir en el prompt enviado a Groq para una Orden_Divina: el texto completo de la orden, la lista de ciudadanos mencionados con sus atributos actuales, el mapa de la Ciudad con las celdas relevantes y las instrucciones para devolver una `Interpretación_Divina` estructurada.
4. WHEN Groq interpreta una Orden_Divina que implica una relación entre dos ciudadanos (por ejemplo, "se enamoran", "se pelean", "se hacen amigos"), THE Motor_de_Simulación SHALL crear o modificar un vínculo entre esos ciudadanos que influya en sus futuros comportamientos generados por IA.
5. WHEN Groq interpreta una Orden_Divina que implica un cambio permanente en una celda de la Ciudad (por ejemplo, "destruye el parque", "construye una fuente"), THE Motor_de_Simulación SHALL actualizar el mapa de la Ciudad para reflejar ese cambio de forma persistente durante el resto de la sesión.
6. THE Motor_de_Simulación SHALL garantizar que los cambios aplicados por una Orden_Divina sean coherentes con las reglas de la simulación; IF un cambio solicitado viola una regla fundamental (por ejemplo, resucitar a un ciudadano muerto), THEN THE Motor_de_Simulación SHALL aplicar la versión más cercana posible al efecto solicitado (por ejemplo, crear un nuevo ciudadano con el mismo nombre) y notificar al usuario en el Chatbot_Divino.
7. THE Chatbot_Divino SHALL mostrar una confirmación textual de cada Orden_Divina ejecutada, describiendo en lenguaje natural qué cambió en la simulación como resultado de la orden.
