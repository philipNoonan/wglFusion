const so3ReduceSource = `#version 310 es
layout(local_size_x = 112, local_size_y = 1) in;

uniform ivec2 imSize;

layout(std430, binding = 0) buffer rowSO3data
{
    vec4 rowSO3[];
};

layout(std430, binding = 1) buffer reductionOutputData
{
	float outputData[];
};

shared float S[112][11];


void main()
{
	int devNumber = 0;
    int sline = int(gl_LocalInvocationID.x); // 0 - 111

    float sums[11];

    for (int i = 0; i < 11; ++i)
    {
        sums[i] = 0.0f;
    }

    for (int y = int(gl_WorkGroupID.x); y < imSize.y; y += int(gl_NumWorkGroups.x)) 
    {
      for (int x = sline; x < imSize.x; x += int(gl_WorkGroupSize.x))
      {
			  if (rowSO3[(y * imSize.x) + x].w == 0.0f)
			  {
			  	continue;
			  }

			  sums[0] += rowSO3[(y * imSize.x) + x].x * rowSO3[(y * imSize.x) + x].x,
        sums[1] += rowSO3[(y * imSize.x) + x].x * rowSO3[(y * imSize.x) + x].y,
        sums[2] += rowSO3[(y * imSize.x) + x].x * rowSO3[(y * imSize.x) + x].z,
        sums[3] += rowSO3[(y * imSize.x) + x].x * rowSO3[(y * imSize.x) + x].w,
        
        sums[4] += rowSO3[(y * imSize.x) + x].y * rowSO3[(y * imSize.x) + x].y,
        sums[5] += rowSO3[(y * imSize.x) + x].y * rowSO3[(y * imSize.x) + x].z,
        sums[6] += rowSO3[(y * imSize.x) + x].y * rowSO3[(y * imSize.x) + x].w,
        
        sums[7] += rowSO3[(y * imSize.x) + x].z * rowSO3[(y * imSize.x) + x].z,
        sums[8] += rowSO3[(y * imSize.x) + x].z * rowSO3[(y * imSize.x) + x].w,
        
			  sums[9] += rowSO3[(y * imSize.x) + x].w * rowSO3[(y * imSize.x) + x].w, // residual 
        sums[10] += 1.0f;           // inliers
      }
    }

    for (int i = 0; i < 11; ++i)
    {
        S[sline][i] = sums[i];
    }  

    barrier(); // wait for threads to finish

	if (sline < 11)
	{
		for (int i = 1; i < int(gl_WorkGroupSize.x); ++i)
		{
			S[0][sline] += S[i][sline];
		}

		outputData[sline + int(gl_WorkGroupID.x) * 11] = S[0][sline];
	}
}
`;