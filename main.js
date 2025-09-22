// --- CANVAS-RELATED ---
let canvas;
let codeEditor;
let btn;
// --- WEBGL-RELATED ---
let gl;
let vao;

let vertices;
let mouse = [0,0]; 

let startTime;
let now;
let dt;
// --- SHADER-RELATED ---
let shader;

let timeloc;
let resloc;
let mouseloc;

let projloc;
let projectionMatrix;

const vertexShaderSource = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aCol;

out vec3 Col;

uniform mat4 projection;

void main(){
  gl_Position = projection*vec4(aPos,1.0);
  Col = aCol;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

out vec4 fragColor; // output of the fragment shader

in vec3 Col; // color per vertex

uniform float uTime; // get time
uniform vec2 uResolution; // get canvas resolution
uniform vec2 uMouse; // get mouse position

float sdSphere(vec3 p, float r){
  return length(p) - r;
}

float map(vec3 p){
  return sdSphere(p, 1.0);
}

float march(vec3 ro, vec3 rd){
  float t = 0.0;
  for(int i = 0; i < 100; i++){
    vec3 p = ro + t*rd;
    float d = map(p);
    if(d < 0.001) return t;
    t += d;
    if(t > 100.0) break;
  }
  return -1.0;
}

vec3 getNormal(vec3 p){
  float e = 0.001;
  float x = map(p + vec3(e,0.0,0.0)) - map(p - vec3(e,0.0,0.0));
  float y = map(p + vec3(0.0,e,0.0)) - map(p - vec3(0.0,e,0.0));
  float z = map(p + vec3(0.0,0.0,e)) - map(p - vec3(0.0,0.0,e));
  return normalize(vec3(x,y,z));
}

void main(){
  float aspect = uResolution.x/uResolution.y; // aspect ratio
  vec2 st = gl_FragCoord.xy/uResolution; // normalized fragment coordinates
  vec2 mouse = uMouse/uResolution; // normalized mouse positions

  vec2 uv = st*2.0 - 1.0;
  uv.x *= aspect;
  
  vec3 ro = vec3(0.0,0.0,3.0);
  vec3 rd = vec3(uv, -1.0);
  vec3 lp = vec3(2.0*sin(uTime),2.0,2.0*cos(uTime));
  // using raymarching
  float t = march(ro, rd);
  if(t > 0.0){
    vec3 p = ro + t*rd;
    vec3 n = getNormal(p);
    vec3 l = normalize(lp - p);
    vec3 v = normalize(ro - p);
    vec3 r = reflect(-l,n);
    
    float diff = max(dot(l,n),0.0);
    float spec = pow(max(dot(r,v),0.0),32.0);
    float amb = 0.1;
    float phong = amb + diff + spec;
    
    vec3 color = vec3(1.0,0.4,0.0);
    color *= phong;
    fragColor = vec4(color,1.0);
  }
  else{
    vec3 c1 = vec3(0.0,0.0,0.3);
    vec3 c2 = vec3(0.2,0.2,0.5);
    vec3 color = mix(c1,c2,st.y);
    fragColor = vec4(color,1.0);
  }
}
`; 

// --- SHADER-PROGRAM-FUNCTIONS ---

function createShader(gl, type, source) {
  const shdr = gl.createShader(type);
  gl.shaderSource(shdr,source);
  gl.compileShader(shdr);

  if(!gl.getShaderParameter(shdr,gl.COMPILE_STATUS)){
    alert("ERROR: Compiling-Shader! Check Console For Detailed Error!");
    console.error(gl.getShaderInfoLog(shdr));
    return null;
  }
  
  return shdr;
}

function createProgram(gl, vert, frag) {
  const id = gl.createProgram();
  gl.attachShader(id,vert);
  gl.attachShader(id,frag);
  gl.linkProgram(id);

  if(!gl.getProgramParameter(id,gl.LINK_STATUS)){
    alert("ERROR: Creating Shader-Program! Check Console For Detailed Error!");
    console.error(gl.getProgramInfoLog(id));
    return null;
  }
  
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return id;
}

function compileShader() {
  const vert = createShader(gl,gl.VERTEX_SHADER,vertexShaderSource);
  const frag = createShader(gl,gl.FRAGMENT_SHADER,codeEditor.value);
  shader = createProgram(gl,vert,frag);

  timeloc = gl.getUniformLocation(shader, "uTime");
  mouseloc = gl.getUniformLocation(shader, "uMouse");
  resloc = gl.getUniformLocation(shader, "uResolution");
  projloc = gl.getUniformLocation(shader, "projection");
}

// --- PROJECTION-FUNCTION ---

function ortho(l,r,b,t,n,f) {
  return new Float32Array([
    2.0/(r-l),    0.0,          0.0,           0.0,
    0.0,          2.0/(t-b),    0.0,           0.0,
    0.0,          0.0,          -2.0/(f-n),    0.0,
    -(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1.0
  ]);
}
// --- INITIALIZATION-FUNCTIONS ---

function initGL() {
  // fetch elements from html
  canvas = document.getElementById("shader-canvas");
  codeEditor = document.getElementById("code-editor");
  btn = document.getElementById("run-button");
  
  // get webgl context
  gl = canvas.getContext("webgl2");
  
  // resize canvas according to css styling
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // setting code for codeEditor initially
  codeEditor.value = fragmentShaderSource;

  if(!gl){
    alert("ERROR: WebGL2 Not Supported!");
  }
  
  // viewport init
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(0.0,0.0,0.0,1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // initialize vertex-data
  vertices = new Float32Array([
    // vertex-positions           // vertex-colors
    0.0,          0.0,            0.0,    1.0,    0.0,    0.0,
    canvas.width, 0.0,            0.0,    0.0,    1.0,    0.0,
    canvas.width, canvas.height,  0.0,    0.0,    0.0,    1.0,
    canvas.width, canvas.height,  0.0,    0.0,    0.0,    1.0,
    0.0,          canvas.height,  0.0,    0.0,    1.0,    0.0,
    0.0,          0.0,            0.0,    1.0,    0.0,    0.0
  ]);
  
  // creating initial shader program
  compileShader();
  
  // getting uniform locations
  timeloc = gl.getUniformLocation(shader,"uTime");
  mouseloc = gl.getUniformLocation(shader,"uMouse");
  resloc = gl.getUniformLocation(shader,"uResolution");
  projloc = gl.getUniformLocation(shader,"projection");
  
  // calculating projection matrix
  projectionMatrix = ortho(0,canvas.width,0,canvas.height,-1,1);

  // creating vao and vbo
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0,3,gl.FLOAT,false,6*4,0);

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1,3,gl.FLOAT,false,6*4,3*4);

  gl.bindVertexArray(null);
  
  // initialize timer
  startTime = performance.now();

  // setting up event-listeners
  btn.addEventListener("click",compileShader);
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse[0] = e.clientX - rect.left;
    mouse[1] = rect.height - (e.clientY - rect.top);
  });
}

// --- RENDERING-FUNCTION ---
function render() {
  // calculate elapsedTime
  now = performance.now();
  dt = (now - startTime)/1000.0;

  gl.clearColor(0.0,0.0,0.0,1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shader);

  gl.uniform1f(timeloc,dt);
  gl.uniform2f(mouseloc,mouse[0],mouse[1]);
  gl.uniform2f(resloc,canvas.width,canvas.height);
  
  gl.uniformMatrix4fv(projloc,false,projectionMatrix);

  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindVertexArray(null);

  requestAnimationFrame(render);
}

// --- MAIN-FUNCTION---

function main(){
  initGL();
  requestAnimationFrame(render);
}

main();
