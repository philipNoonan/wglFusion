const se3ReduceStepSource = `#version 310 es
layout(local_size_x = 112, local_size_y = 1) in;

uniform ivec2 imSize;

struct JtJJtrSE3
{
    // // 27 floats for each product (27)
    //float aa, ab, ac, ad, ae, af, ag,
    //          bb, bc, bd, be, bf, bg,
    //              cc, cd, ce, cf, cg,
    //                  dd, de, df, dg,
    //                      ee, ef, eg,
    //                          ff, fg;

	float data[27];

    //Extra data needed (29)
    float residual;
	float inliers;
};

struct rowSE3
{
	float data[7];
	float inliers;
};

struct DataTerm
{
	ivec2 zero;
    ivec2 one;
    float diff;
    bool valid;
};

layout(std430, binding = 0) buffer JtJJtrSE3Data
{
    rowSE3 JtJJtrSE3buffer[];
};

layout(std430, binding = 1) buffer reductionOutputData
{
	float outputData[];
};

shared float S[112][32];


void main()
{
	int devNumber = 0;
    int sline = int(gl_LocalInvocationID.x); // 0 - 111

    float sums[32];

    for (int i = 0; i < 32; ++i)
    {
        sums[i] = 0.0f;
    }

    for (int y = int(gl_WorkGroupID.x); y < imSize.y; y += int(gl_NumWorkGroups.x)) 
    {
        for (int x = sline; x < imSize.x; x += int(gl_WorkGroupSize.x)) 
        {
			if (JtJJtrSE3buffer[(y * imSize.x) + x].inliers == 0.0f)
			{
				continue;
			}

			sums[0] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[0],
            sums[1] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[1],
            sums[2] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[2],
            sums[3] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[3],
            sums[4] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[4],
            sums[5] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[6] += JtJJtrSE3buffer[(y * imSize.x) + x].data[0] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],

            sums[7] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[1],
            sums[8] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[2],
            sums[9] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[3],
            sums[10] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[4],
            sums[11] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[12] += JtJJtrSE3buffer[(y * imSize.x) + x].data[1] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],

            sums[13] += JtJJtrSE3buffer[(y * imSize.x) + x].data[2] * JtJJtrSE3buffer[(y * imSize.x) + x].data[2],
            sums[14] += JtJJtrSE3buffer[(y * imSize.x) + x].data[2] * JtJJtrSE3buffer[(y * imSize.x) + x].data[3],
            sums[15] += JtJJtrSE3buffer[(y * imSize.x) + x].data[2] * JtJJtrSE3buffer[(y * imSize.x) + x].data[4],
            sums[16] += JtJJtrSE3buffer[(y * imSize.x) + x].data[2] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[17] += JtJJtrSE3buffer[(y * imSize.x) + x].data[2] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],
			
			sums[18] += JtJJtrSE3buffer[(y * imSize.x) + x].data[3] * JtJJtrSE3buffer[(y * imSize.x) + x].data[3],
            sums[19] += JtJJtrSE3buffer[(y * imSize.x) + x].data[3] * JtJJtrSE3buffer[(y * imSize.x) + x].data[4],
            sums[20] += JtJJtrSE3buffer[(y * imSize.x) + x].data[3] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[21] += JtJJtrSE3buffer[(y * imSize.x) + x].data[3] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],

            sums[22] += JtJJtrSE3buffer[(y * imSize.x) + x].data[4] * JtJJtrSE3buffer[(y * imSize.x) + x].data[4],
            sums[23] += JtJJtrSE3buffer[(y * imSize.x) + x].data[4] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[24] += JtJJtrSE3buffer[(y * imSize.x) + x].data[4] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],

            sums[25] += JtJJtrSE3buffer[(y * imSize.x) + x].data[5] * JtJJtrSE3buffer[(y * imSize.x) + x].data[5],
            sums[26] += JtJJtrSE3buffer[(y * imSize.x) + x].data[5] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],

            sums[27] += JtJJtrSE3buffer[(y * imSize.x) + x].data[6] * JtJJtrSE3buffer[(y * imSize.x) + x].data[6],
            sums[28] += JtJJtrSE3buffer[(y * imSize.x) + x].inliers;


        }
    }


    for (int i = 0; i < 32; ++i)
    {
        S[sline][i] = sums[i];
    }  

    barrier(); // wait for threads to finish

	if (sline < 32)
	{
		for (int i = 1; i < int(gl_WorkGroupSize.x); ++i)
		{
			S[0][sline] += S[i][sline];
		}

		outputData[sline + int(gl_WorkGroupID.x) * 32] = S[0][sline];
		//imageStore(outputData, ivec2(sline, int(gl_WorkGroupID.x)), vec4(S[0][sline]));

	}

}
`;