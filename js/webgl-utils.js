/**
 * WebGL 工具函数库
 * 基于 webglfundamentals.org 教程整理
 * 提供着色器编译、程序链接、矩阵运算等常用功能
 */

const WebGLUtils = {
  /**
   * 创建并编译一个着色器
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @param {number} type - 着色器类型 (gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER)
   * @param {string} source - GLSL着色器源码
   * @returns {WebGLShader} 编译后的着色器
   */
  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    }
    console.error('着色器编译错误:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  },

  /**
   * 创建着色器程序并链接顶点/片元着色器
   * @param {WebGLRenderingContext} gl
   * @param {WebGLShader} vertexShader
   * @param {WebGLShader} fragmentShader
   * @returns {WebGLProgram}
   */
  createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return program;
    }
    console.error('程序链接错误:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  },

  /**
   * 从源码字符串直接创建着色器程序
   * @param {WebGLRenderingContext} gl
   * @param {string} vsSource - 顶点着色器源码
   * @param {string} fsSource - 片元着色器源码
   * @returns {WebGLProgram}
   */
  createProgramFromSources(gl, vsSource, fsSource) {
    const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    return this.createProgram(gl, vs, fs);
  },

  /**
   * 调整canvas尺寸以匹配显示尺寸
   * @param {HTMLCanvasElement} canvas
   * @returns {boolean} 是否发生了尺寸变化
   */
  resizeCanvasToDisplaySize(canvas) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      return true;
    }
    return false;
  }
};

/**
 * 3x3矩阵运算（用于2D变换）
 * 矩阵以列主序一维数组存储（与WebGL一致）
 */
const M3 = {
  // 单位矩阵
  identity() {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
  },

  // 投影矩阵：将像素坐标转换为裁剪空间 [-1, 1]
  projection(width, height) {
    return [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1,
    ];
  },

  // 平移矩阵
  translation(tx, ty) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },

  // 旋转矩阵（弧度）
  rotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, s, 0,
      -s, c, 0,
      0, 0, 1,
    ];
  },

  // 缩放矩阵
  scaling(sx, sy) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ];
  },

  // 3x3矩阵乘法
  multiply(a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];
    const a20 = a[6], a21 = a[7], a22 = a[8];
    const b00 = b[0], b01 = b[1], b02 = b[2];
    const b10 = b[3], b11 = b[4], b12 = b[5];
    const b20 = b[6], b21 = b[7], b22 = b[8];
    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ];
  },

  // 便捷方法：在矩阵上叠加平移
  translate(m, tx, ty) {
    return this.multiply(m, this.translation(tx, ty));
  },
  rotate(m, angleInRadians) {
    return this.multiply(m, this.rotation(angleInRadians));
  },
  scale(m, sx, sy) {
    return this.multiply(m, this.scaling(sx, sy));
  },
};

/**
 * 4x4矩阵运算（用于3D变换）
 * 矩阵以列主序一维数组存储
 */
const M4 = {
  identity() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  },

  // 正交投影矩阵
  orthographic(left, right, bottom, top, near, far) {
    return [
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, 2 / (near - far), 0,
      (left + right) / (left - right),
      (bottom + top) / (bottom - top),
      (near + far) / (near - far),
      1,
    ];
  },

  // 透视投影矩阵
  perspective(fovRadians, aspect, near, far) {
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fovRadians);
    const rangeInv = 1.0 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0,
    ];
  },

  translation(tx, ty, tz) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ];
  },

  xRotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ];
  },

  yRotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ];
  },

  zRotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  },

  scaling(sx, sy, sz) {
    return [
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ];
  },

  // 4x4矩阵乘法
  multiply(a, b) {
    const b00 = b[0 * 4 + 0], b01 = b[0 * 4 + 1], b02 = b[0 * 4 + 2], b03 = b[0 * 4 + 3];
    const b10 = b[1 * 4 + 0], b11 = b[1 * 4 + 1], b12 = b[1 * 4 + 2], b13 = b[1 * 4 + 3];
    const b20 = b[2 * 4 + 0], b21 = b[2 * 4 + 1], b22 = b[2 * 4 + 2], b23 = b[2 * 4 + 3];
    const b30 = b[3 * 4 + 0], b31 = b[3 * 4 + 1], b32 = b[3 * 4 + 2], b33 = b[3 * 4 + 3];
    const a00 = a[0 * 4 + 0], a01 = a[0 * 4 + 1], a02 = a[0 * 4 + 2], a03 = a[0 * 4 + 3];
    const a10 = a[1 * 4 + 0], a11 = a[1 * 4 + 1], a12 = a[1 * 4 + 2], a13 = a[1 * 4 + 3];
    const a20 = a[2 * 4 + 0], a21 = a[2 * 4 + 1], a22 = a[2 * 4 + 2], a23 = a[2 * 4 + 3];
    const a30 = a[3 * 4 + 0], a31 = a[3 * 4 + 1], a32 = a[3 * 4 + 2], a33 = a[3 * 4 + 3];
    return [
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
    ];
  },

  translate(m, tx, ty, tz) {
    return this.multiply(m, this.translation(tx, ty, tz));
  },
  xRotate(m, angle) {
    return this.multiply(m, this.xRotation(angle));
  },
  yRotate(m, angle) {
    return this.multiply(m, this.yRotation(angle));
  },
  zRotate(m, angle) {
    return this.multiply(m, this.zRotation(angle));
  },
  scale(m, sx, sy, sz) {
    return this.multiply(m, this.scaling(sx, sy, sz));
  },

  // 逆矩阵
  inverse(m) {
    const m00 = m[0 * 4 + 0], m01 = m[0 * 4 + 1], m02 = m[0 * 4 + 2], m03 = m[0 * 4 + 3];
    const m10 = m[1 * 4 + 0], m11 = m[1 * 4 + 1], m12 = m[1 * 4 + 2], m13 = m[1 * 4 + 3];
    const m20 = m[2 * 4 + 0], m21 = m[2 * 4 + 1], m22 = m[2 * 4 + 2], m23 = m[2 * 4 + 3];
    const m30 = m[3 * 4 + 0], m31 = m[3 * 4 + 1], m32 = m[3 * 4 + 2], m33 = m[3 * 4 + 3];
    const tmp0  = m22 * m33, tmp1  = m32 * m23, tmp2  = m12 * m33;
    const tmp3  = m32 * m13, tmp4  = m12 * m23, tmp5  = m22 * m13;
    const tmp6  = m02 * m33, tmp7  = m32 * m03, tmp8  = m02 * m23;
    const tmp9  = m22 * m03, tmp10 = m02 * m13, tmp11 = m12 * m03;
    const tmp12 = m20 * m31, tmp13 = m30 * m21, tmp14 = m10 * m31;
    const tmp15 = m30 * m11, tmp16 = m10 * m21, tmp17 = m20 * m11;
    const tmp18 = m00 * m31, tmp19 = m30 * m01, tmp20 = m00 * m21;
    const tmp21 = m20 * m01, tmp22 = m00 * m11, tmp23 = m10 * m01;

    const t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) - (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
    const t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) - (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
    const t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) - (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
    const t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) - (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);

    const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

    return [
      d * t0, d * t1, d * t2, d * t3,
      d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) - (tmp0 * m10 + tmp3 * m20 + tmp4 * m30)),
      d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) - (tmp1 * m00 + tmp6 * m20 + tmp9 * m30)),
      d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) - (tmp2 * m00 + tmp7 * m10 + tmp10 * m30)),
      d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) - (tmp5 * m00 + tmp8 * m10 + tmp11 * m20)),
      d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) - (tmp13 * m13 + tmp14 * m23 + tmp17 * m33)),
      d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) - (tmp12 * m03 + tmp19 * m23 + tmp20 * m33)),
      d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) - (tmp15 * m03 + tmp18 * m13 + tmp23 * m33)),
      d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) - (tmp16 * m03 + tmp21 * m13 + tmp22 * m23)),
      d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) - (tmp16 * m32 + tmp12 * m12 + tmp15 * m22)),
      d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) - (tmp18 * m22 + tmp21 * m32 + tmp13 * m02)),
      d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) - (tmp22 * m32 + tmp14 * m02 + tmp19 * m12)),
      d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) - (tmp20 * m12 + tmp23 * m22 + tmp17 * m02)),
    ];
  },

  // 转置
  transpose(m) {
    return [
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    ];
  },

  // 向量叉积
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },

  // 向量减法
  subtractVectors(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  // 向量归一化
  normalize(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length > 0.00001) {
      return [v[0] / length, v[1] / length, v[2] / length];
    }
    return [0, 0, 0];
  },

  // lookAt矩阵（相机矩阵）
  lookAt(cameraPosition, target, up) {
    const zAxis = this.normalize(this.subtractVectors(cameraPosition, target));
    const xAxis = this.normalize(this.cross(up, zAxis));
    const yAxis = this.normalize(this.cross(zAxis, xAxis));
    return [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
      cameraPosition[0], cameraPosition[1], cameraPosition[2], 1,
    ];
  },
};
