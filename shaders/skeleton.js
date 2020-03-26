const skeletonVertexShaderSource = `#version 310 es
    layout (location = 0) in vec2 pos;

    layout(binding = 0, rgba16ui) readonly uniform highp uimage2D mappingC2DMap;
    layout(binding = 1, rgba16ui) readonly uniform highp uimage2D mappingD2CMap;
    
    uniform vec2 imageSize;

    void main()
    {
        vec2 depthPos = vec2(imageLoad(mappingC2DMap, ivec2(pos)).xy);

        // if (depthPos == vec2(0.0f)) 
        // {
        //     depthPos = pos;
        // }

        gl_Position = vec4((depthPos.x / imageSize.x) * 2.0f - 1.0f, 1.0f - (depthPos.y / imageSize.y) * 2.0f, 0, 1);
        gl_PointSize = 10.0f;
    }
   `;
   
const skeletonFragmentShaderSource = `#version 310 es
    precision mediump float;

    out vec4 outColor;
    void main()
    {
        outColor = vec4(0, 1.0, 0.0f, 1.0f);
    }
  `;