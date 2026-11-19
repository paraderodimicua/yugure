# PROMPT MAESTRO — YŪGURE (夕暮れ, "atardecer")

> Pega este documento completo como primer mensaje de una sesión nueva.
> Antes de pegarlo, elige una opción en cada bloque de la sección 2 (o deja las marcadas como RECOMENDADA).

---

## 0. Tu rol

Eres director técnico y director de arte de **YŪGURE**, un juego original de parkour infinito y relajado. Tu objetivo es un **10/10 visual**: cualquier captura del juego debe poder pasar por un fotograma de una película de animación japonesa en la hora dorada. La jugabilidad existe para sostener la contemplación, no al revés.

Trabajas de forma autónoma por fases (sección 9). No pasas de fase sin cumplir sus criterios de aceptación, y los compruebas con capturas reales del juego en ejecución, no leyendo el código.

Es un juego original: no copies nombre, personajes, niveles ni arte de ningún juego o película existente. Las referencias de la sección 2 son de *lenguaje visual* (luz, paleta, composición), no de contenido.

---

## 1. Visión y pilares

**Frase guía:** *"Correr por los tejados de un atardecer que nunca termina."*

El jugador está relajado, con poca atención y mucha sensibilidad a lo sensorial. Todo se diseña para eso:

1. **Cero estrés.** No hay muerte, ni game over, ni vidas, ni temporizador, ni textos que regañen. Fallar un salto = una corriente de viento con pétalos te recoge y te deposita suavemente en la siguiente plataforma. El flujo nunca se corta.
2. **Gráficos primero.** Ante cualquier conflicto entre una mecánica y la belleza del plano, gana el plano.
3. **Hipnótico.** Ritmo regular, movimiento fluido, música y luz sincronizadas. Nada de parpadeos, flashes, sacudidas de cámara bruscas ni sonidos agudos.
4. **Progresión lentísima e infinita.** La velocidad sube de forma casi imperceptible y no tiene techo (sección 4).
5. **Carga cognitiva mínima.** Se juega con un solo botón. Todo lo demás es opcional.
6. **Sirve también para solo mirar.** Modo automático en el que el personaje corre solo y el juego es un salvapantallas vivo.

---

## 2. Opciones (elige una por bloque)

### 2.1 Dirección de arte

| | Opción | Descripción | Riesgo |
|---|---|---|---|
| **A — RECOMENDADA** | **Hora dorada cinematográfica** | Iluminación físicamente creíble + acabado anime: cielos enormes de cúmulos pintados, sol bajo, contraluces fuertes, destellos de lente, sombras azul-violeta, bordes dorados en todo. Realismo en la luz, estilización en las formas. | Exige el mejor cielo y postprocesado; es donde se gana el 10 |
| B | Acuarela rural | Paleta pastel, colinas, arrozales, pueblos de madera, luz difusa y cálida, trazo suave. Más tierno, menos espectacular. | Puede quedar plano si la luz no es buena |
| C | Ciudad al anochecer | Azoteas urbanas, cables, depósitos de agua, carteles luminosos que se encienden, cielo magenta-índigo, reflejos húmedos. | Los neones compiten con el atardecer; más carga de GPU |

Con A, las opciones B y C no se pierden: pasan a ser **biomas** que aparecen con la distancia (sección 5).

### 2.2 Cámara

| | Opción | Por qué |
|---|---|---|
| **A — RECOMENDADA** | **Tercera persona 3D, cámara lateral-trasera cinematográfica** (≈35° detrás del hombro, baja, con el sol dentro de plano) | Muestra personaje + cielo + profundidad a la vez; el plano más "película" |
| B | Vista lateral 2.5D con parallax profundo | Más sencillo de jugar y de producir; menos inmersivo |
| C | Primera persona | Muy inmersivo, pero marea y oculta la animación del personaje |

### 2.3 Tecnología

| | Opción | Por qué |
|---|---|---|
| **A — RECOMENDADA** | **Web: Three.js + TypeScript + Vite**, WebGL2 con postprocesado propio | Se abre con un enlace, itera rápido, verificable en el navegador con capturas |
| B | Godot 4 (Forward+) | Mejor iluminación global de serie y ejecutable nativo; iteración y verificación más lentas |
| C | Unreal Engine 5 | Techo visual más alto (Lumen); desproporcionado para este alcance |

### 2.4 Ciclo de luz

| | Opción |
|---|---|
| **A — RECOMENDADA** | **Atardecer eterno que respira**: el sol oscila muy despacio entre hora dorada → puesta → hora azul con primeras estrellas → vuelve a dorada. Ciclo de ~12 min. Nunca mediodía, nunca noche cerrada. |
| B | Hora dorada fija, sin ciclo |
| C | Día completo acelerado |

**Todo lo que sigue asume A / A / A / A.** Si se elige otra cosa, adapta las secciones afectadas manteniendo los pilares.

---

## 3. Jugabilidad

- **Movimiento automático** hacia delante. El jugador solo decide *cuándo*.
- **Un botón** (Espacio / clic / toque / botón A del mando):
  - pulsar = salto; mantener = salto más largo y planeo suave;
  - cerca de una pared = carrera por la pared automática;
  - cerca de un borde = agarre y subida automáticos;
  - sobre un cable o barandilla = deslizamiento.
- **Ventanas de acierto muy generosas** (coyote time ≥ 150 ms, buffer de entrada ≥ 200 ms, imán suave hacia el punto de aterrizaje). El juego interpreta siempre a favor del jugador.
- **Fallo = rescate**: viento + pétalos + nota musical suave, 1,2 s de planeo guiado, se sigue corriendo. Sin penalización de velocidad ni de puntuación.
- **Sin puntuación numérica en pantalla.** Solo distancia en un rincón, pequeña, y ocultable.
- **Racha de fluidez (invisible)**: encadenar movimientos sin rescate intensifica gradualmente partículas, estelas y capas de música. Es recompensa sensorial, no un número.
- **Coleccionables opcionales**: farolillos de papel flotantes que al tocarlos sueltan una nota afinada a la música y una ráfaga de luz. No se cuentan con insistencia.
- **Modo Contemplar**: el personaje juega solo con una IA de entrada perfecta; la cámara alterna planos cinematográficos. Se activa con una tecla y también tras 20 s sin entrada.
- **Modo Foto**: pausa, cámara libre, ocultar interfaz, guardar PNG.

---

## 4. Progresión de velocidad (lenta e infinita)

Curva logarítmica: crece siempre, cada vez más despacio, sin techo.

```
v(t) = v0 · (1 + k · ln(1 + t / T))
v0 = 6 m/s    k = 0,18    T = 90 s    (t = segundos de carrera efectiva)
```

| Tiempo jugado | Multiplicador | Sensación |
|---|---|---|
| 0 | 1,00× | paseo al trote |
| 10 min | ≈1,37× | apenas se nota |
| 1 h | ≈1,67× | carrera fluida |
| 10 h | ≈2,08× | rápido pero legible |
| 100 h | ≈2,49× | sigue subiendo |

Reglas obligatorias para que siga siendo relajado a cualquier velocidad:

- **Todo escala con la velocidad**: distancia entre plataformas, longitud de salto, anticipación de cámara y distancia de generación se multiplican por el mismo factor, de modo que el **tiempo de reacción del jugador sea constante** (≥ 1,2 s entre decisiones).
- El campo de visión se abre como máximo +8° a lo largo de toda la curva. Sin desenfoque de movimiento agresivo.
- La velocidad se guarda entre sesiones (almacenamiento local) y se puede reiniciar desde el menú.
- La velocidad nunca baja por fallar.

---

## 5. Mundo y fondos

Generación procedural por **tramos** (chunks) con semilla, ensamblados a partir de piezas diseñadas a mano para que cada plano esté compuesto.

**Capas de profundidad (de lejos a cerca), todas con parallax real:**
1. Cúpula de cielo con degradado físico + sol + estrellas tempranas.
2. Cúmulos volumétricos gigantes iluminados a contraluz.
3. Montañas lejanas en siluetas azuladas escalonadas (perspectiva aérea).
4. Ciudad o valle a media distancia con ventanas que se van encendiendo.
5. Capa jugable: tejados, torres, pasarelas, cables.
6. Primer plano desenfocado: ramas, cables, farolillos, pájaros que cruzan.

**Biomas** (transición continua cada ~4-6 min, mezclando paleta y piezas, nunca corte brusco):
- **Tejados de teja** — pueblo tradicional, cerezos, torii, tendederos.
- **Azoteas urbanas** — depósitos de agua, aires acondicionados, postes y marañas de cables, carteles.
- **Costa** — espigones, vías de tren junto al mar, reflejo del sol en el agua.
- **Arrozales y colinas** — pasarelas de madera, espantapájaros, agua espejo.
- **Sobre las nubes** — islas y templos flotantes, mar de nubes (aparece solo tras mucho tiempo: recompensa a la constancia).

Vida ambiental: bandadas de pájaros, un tren lejano que cruza, gatos en los tejados, ropa tendida que ondea, cometas, humo de chimeneas.

---

## 6. Gráficos e iluminación (el corazón del proyecto)

### 6.1 Principio
**Luz realista, superficie estilizada.** La luz se comporta como en una cámara real (HDR, exposición, dispersión atmosférica, rebote cálido); los materiales se resuelven con sombreado anime (bandas suaves de color, sombras tintadas, sin ruido fotográfico).

### 6.2 Flujo de render
- Render en **HDR lineal** (buffers de coma flotante), espacio de color correcto de principio a fin.
- **Mapeo de tonos fílmico** (AgX o ACES) + **gradación de color con LUT** por bioma y por momento del ciclo.
- Luz direccional del sol con **sombras en cascada** suaves; las sombras se tiñen de azul-violeta, nunca negras.
- Luz ambiental por **sondas/hemisferio derivada del cielo actual**, para que todo se bañe del color del momento.
- **Luz de contorno** (rim) dorada en personaje y geometría mirando al sol: es la firma visual.

### 6.3 Cielo y atmósfera
- Dispersión atmosférica (Rayleigh + Mie) para el degradado y el halo solar.
- **Nubes**: capa volumétrica o cúmulos pintados sobre impostores con normales, iluminados por el sol con borde plateado y vientre en sombra violeta. Deben moverse y evolucionar lentamente. Esta pieza merece el mayor esfuerzo del proyecto.
- **Niebla de altura y perspectiva aérea**: cada capa lejana más clara, más azul y menos contrastada.
- **Rayos crepusculares** (god rays) desde el sol a través de nubes y edificios.

### 6.4 Postprocesado (en este orden)
1. Oclusión ambiental sutil (SSAO/GTAO).
2. Rayos volumétricos en espacio de pantalla.
3. **Bloom** de umbral alto, radio amplio y suave.
4. Destellos de lente anamórficos discretos al mirar al sol.
5. Profundidad de campo ligera (primer plano y fondo lejano).
6. Mapeo de tonos + LUT.
7. Viñeta suave, aberración cromática mínima solo en bordes, grano fino de película.
8. Antialiasing temporal o SMAA. Sin dientes de sierra en ningún caso.

### 6.5 Materiales
- Sombreado toon de 2-3 bandas con transición suave y rampa de color tintada (no gris).
- Contornos finos opcionales por profundidad/normales, color oscuro cálido, grosor variable con la distancia.
- Texturas con aspecto pintado a mano; nada de fotografías.
- **Agua**: reflejo del cielo, camino de sol especular, ondas suaves.
- **Cristales y ventanas**: reflejan el cielo; al caer la luz se encienden con emisivo cálido.
- **Vegetación**: animación de viento en el shader de vértices, translucidez a contraluz.

### 6.6 Partículas y ambiente
Todo en GPU, instanciado, con iluminación coherente con el sol:
- pétalos de cerezo y hojas llevados por un campo de viento común;
- motas de polvo doradas visibles solo en los haces de luz;
- luciérnagas al llegar la hora azul;
- polvo y pequeñas tejas al aterrizar, estela suave al correr por paredes;
- vapor, humo de chimeneas, bruma baja;
- estrellas fugaces ocasionales;
- pájaros como partículas con aleteo.

La densidad y el brillo de las partículas suben con la racha de fluidez.

### 6.7 Personaje
- Silueta original, legible a contraluz: ropa amplia y bufanda o tela larga con **simulación de tela** que deje estela.
- Animación fluida con mezcla e IK de pies y manos: carrera, salto, planeo, carrera por pared, agarre, voltereta de aterrizaje, deslizamiento. Sin deslizamiento de pies.
- La calidad de animación forma parte de "gráficos": un personaje rígido arruina el plano.

### 6.8 Cámara
- Seguimiento con muelle amortiguado, sin sacudidas.
- Composición por regla de tercios: personaje en el tercio inferior-izquierdo, sol y cielo ocupando ≥ 55 % del encuadre.
- Variaciones lentas y automáticas de ángulo según el tramo (plano general en saltos largos, más cerca en pasillos).

### 6.9 Rendimiento
- Objetivo: **60 fps a 1080p** en una gráfica integrada moderna; 3 niveles de calidad (Bajo / Medio / Cine) + **resolución dinámica** automática.
- Instanciado, LOD, descarte por frustum, reciclaje de tramos, atlas de texturas, sin reservas de memoria por fotograma.
- El nivel Bajo debe seguir siendo bonito: se recorta volumetría y resolución, nunca la paleta ni el cielo.

---

## 7. Audio

- Música **lo-fi / ambient generativa** por capas (batería suave, bajo, piano eléctrico, pads, melodía), 70-85 BPM, que añade capas con la racha de fluidez. El tempo sube como mucho un 10 % a lo largo de toda la curva de velocidad.
- Los pasos, aterrizajes y farolillos están **cuantizados y afinados a la tonalidad** de la música: jugar suena a tocar.
- Ambiente por bioma: viento, cigarras, campanillas de viento, mar, tren lejano.
- Mezcla cálida, sin agudos duros; filtro paso bajo suave durante el rescate.
- Toda la música y los sonidos deben ser originales, generados por código o con licencia libre verificada.

---

## 8. Interfaz y arquitectura

**Interfaz:** casi inexistente. Título que se desvanece al empezar a correr, distancia pequeña, menú de pausa translúcido con: calidad, volumen, modo Contemplar, modo Foto, ocultar interfaz, reiniciar velocidad. Tipografía fina y elegante. Sin tutorial con texto: un único icono del botón que desaparece al primer salto.

**Arquitectura (opción web):**
```
src/
  core/        bucle, tiempo, entrada, guardado, ajustes de calidad
  world/       generador de tramos, biomas, piezas, reciclaje
  player/      controlador, estados de parkour, animación, tela
  render/      cielo, nubes, luces, materiales toon, postprocesado, LUT
  fx/          partículas, viento, estelas
  audio/       música por capas, cuantización, ambiente
  camera/      seguimiento, composición, modo contemplar, modo foto
  ui/          interfaz mínima, menú
```
- Sistemas desacoplados por eventos; todos los valores de diseño en un único archivo de configuración.
- Generación determinista por semilla. Paso de física fijo, render interpolado.
- Antes de usar cualquier API de librería, consulta su documentación actual en lugar de fiarte de la memoria.

---

## 9. Plan por fases

Cada fase termina con: juego ejecutándose, capturas tomadas en ejecución, sin errores en consola, y los criterios cumplidos.

| Fase | Entrega | Criterio de aceptación |
|---|---|---|
| **1. El plano** | Escena estática: cielo, sol, nubes, niebla, un tejado, postprocesado completo. Sin juego. | Una captura que ya parezca un fotograma de película. **Si esta fase no es un 9, no se avanza.** |
| **2. Correr** | Personaje, cámara, movimiento automático, salto con un botón, rescate. | 5 minutos seguidos sin un solo corte de flujo ni tirón de cámara |
| **3. Mundo infinito** | Generador de tramos, primer bioma completo, capas de parallax, reciclaje. | 30 min de carrera sin repetición evidente ni caída de fps ni crecimiento de memoria |
| **4. Parkour completo** | Pared, agarre, deslizamiento, planeo, animaciones mezcladas, tela. | Todas las transiciones de animación sin saltos ni deslizamiento de pies |
| **5. Atmósfera** | Partículas, viento, vida ambiental, ciclo de luz, rayos crepusculares. | Capturas en 4 momentos del ciclo, las 4 dignas de fondo de pantalla |
| **6. Sonido** | Música por capas, cuantización, ambiente. | Con los ojos cerrados se percibe la racha de fluidez |
| **7. Progresión y biomas** | Curva de velocidad, escalado del mundo, resto de biomas, transiciones. | Prueba simulada a 1×, 1,7× y 2,5×: tiempo de reacción constante en las tres |
| **8. Modos y pulido** | Contemplar, Foto, menú, niveles de calidad, resolución dinámica. | 60 fps en calidad Media; modo Contemplar 10 min sin un fallo |
| **9. Auditoría 10/10** | Revisión con la lista de la sección 10 y corrección de todo lo que no llegue. | Todos los puntos marcados |

---

## 10. Lista de control del 10/10

- [ ] Cualquier captura al azar es publicable sin retoque.
- [ ] El cielo ocupa más de la mitad del plano y nunca se ve igual dos veces.
- [ ] Ninguna sombra es negra; ningún blanco está quemado sin intención.
- [ ] El personaje se lee siempre por su silueta y su borde de luz.
- [ ] Hay movimiento ambiental en las seis capas de profundidad.
- [ ] No existe ningún momento de frustración: nada mata, nada regaña, nada corta.
- [ ] Se puede jugar entero con un solo botón y sin leer nada.
- [ ] A los 30 minutos apetece seguir mirando.
- [ ] La velocidad ha subido y el jugador no sabe decir cuándo.
- [ ] Sin dientes de sierra, sin parpadeo de sombras, sin popping visible de geometría.
- [ ] 60 fps estables, sin tirones al generar tramos.
- [ ] Sonido y luz cambian juntos; los aterrizajes caen en el compás.
- [ ] Consola sin errores ni avisos.
- [ ] Nada reconocible de ningún juego, película o música existente.

---

## 11. Reglas de trabajo

1. Empieza por la fase 1 y enséñame la captura antes de seguir.
2. Verifica siempre ejecutando el juego y mirando capturas; nunca des algo por bueno sin verlo.
3. Cuando un resultado visual sea "correcto pero normalito", no es suficiente: itera luz, paleta y composición hasta que impresione.
4. Informes breves: qué se hizo, captura, qué falta. Máximo 8 líneas.
5. Si una decisión es de gusto y no está en este documento, elige la opción más bella y más tranquila, y anótala.
6. No añadas mecánicas que generen presión (enemigos, tiempo límite, vidas, tablas de clasificación).

---

## 12. Dirección v2 (manda sobre lo anterior si hay conflicto)

**Escenario:** ya no es un pueblo visto de lejos. Es una **ciudad-aldea de montaña, densa y vertical, medio tragada por la jungla**: callejones estrechos en pendiente, escaleras de piedra con musgo, casas de madera apiladas en terrazas, pagodas, puentes, bambú, lianas, niebla baja y farolillos. Referencia de *ambiente* (no de contenido): valles de aldea frondosa del cine de animación de artes marciales + callejones reales de Japón (Kioto: Gion, Sannenzaka, Pontocho; Onomichi; Tokio: Yanaka, Golden Gai). Todo diseño es original.

**Regla de densidad:** ningún encuadre puede tener una zona vacía. Cada tramo lleva tres escalas de detalle: arquitectura (fachadas, tejados, aleros con vigas), mobiliario (farolillos, noren, carteles, macetas, bicicletas, máquinas expendedoras, cajas, cables, tendederos) y vida (personas, animales, vapor, pétalos, pájaros).

**Anti-plastilina:** prohibidas las superficies lisas de un solo color. Todo material lleva textura procedural con veta, desgaste, suciedad en bordes y relieve; la luz de contorno se limita a siluetas a contraluz. Madera con veta, yeso con manchas, teja real, piedra con musgo, papel washi translúcido, metal con óxido.

**Reflejos nítidos:** el cielo real del juego es el mapa de entorno. Superficies brillantes (laca, cerámica, cristal, agua, charcos, teja mojada, metal) reflejan el atardecer con nitidez.

**Personaje:** diseño original muy detallado (ropa por capas, tela larga con simulación, sandalias, accesorios), animación procedural fluida con anticipación, estiramiento, seguimiento y aterrizajes con peso. Cada salto debe ser satisfactorio: arco limpio, cámara que acompaña, polvo y sonido en el aterrizaje.

**Habitantes** (cada uno con diseño propio, ninguno genérico): anciano con haori, bastón y sombrero de paja; niños en yukata con molinillos y cometas; cocinero con wok al fuego en puesto callejero; mujer con sombrilla de papel; monje barriendo; pescadero; gatos, un shiba, grullas. También se ven **interiores** a través de shoji y ventanas: tatami, mesa baja, lámpara, siluetas.

**Potenciadores** (repartidos por el mapa, estilo "lanzador con mejoras"; nunca castigan): farol-cohete (impulso largo), cometa (planeo extendido), tambor taiko (rebote alto), grulla de papel (vuelo guiado breve), campana de templo (onda que enciende todos los farolillos cercanos), fideos del puesto (racha de velocidad con estela de vapor). Cada uno con efecto visual y sonoro propio.

**Dragones:** al avanzar mucho aparecen dragones orientales enormes entre las nubes y los tejados. No son enemigos: cambian el entorno (su paso trae niebla, lluvia de pétalos, noche de farolillos, mar de nubes) y **se puede correr y saltar sobre su lomo** como si fuera una plataforma viva que ondula.

**Presupuesto:** la máquina de referencia es una Intel UHD 620. Todo se instancia, se fusiona y tiene niveles de calidad; el detalle no puede costar el flujo.

**Orden de trabajo v2:** (1) biblioteca de materiales con textura, (2) kit de arquitectura, (3) kit de mobiliario urbano, (4) vegetación de jungla, (5) personaje y animación, (6) habitantes, (7) calle densa integrada, (8) carrera y saltos, (9) potenciadores, (10) dragones, (11) sonido, (12) auditoría.
