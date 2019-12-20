const vertexShaderSource = `#version 310 es
    in vec2 v;
    out vec2 t;
    void main(){
    gl_Position = vec4(v.x * 2.0 - 1.0, 1.0 - v.y * 2.0, 0, 1);
    t = v;
    }
   `;
   
const fragmentShaderSource = `#version 310 es
    precision mediump float;
    uniform highp sampler2D s;
    in vec2 t;
    out vec4 outColor;
    void main(){
    vec4 tex = vec4(texture(s, t));
    outColor = vec4(abs(vec3(tex.xyz) / 1.0f), 1.0);
  }
  `;