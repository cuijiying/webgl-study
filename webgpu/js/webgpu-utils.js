'use strict';
/**
 * WebGPU 公共工具库
 * 提供初始化、矩阵运算等通用功能，供各 demo 复用。
 */
const WebGPUUtils = (() => {

  /**
   * 初始化 WebGPU：请求适配器、设备，并配置 canvas。
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<{device, context, format, adapter}>}
   */
  async function init(canvas) {
    if (!navigator.gpu) {
      throw new Error('当前浏览器不支持 WebGPU。请使用 Chrome/Edge 113+ 或开启 WebGPU 的浏览器。');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('无法获取 GPU 适配器（requestAdapter 返回 null）。');
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    // 优选的画布纹理格式（通常是 bgra8unorm）
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    });
    // 设备丢失监听，便于调试
    device.lost.then((info) => {
      console.warn('WebGPU device lost:', info.message);
    });
    return { device, context, format, adapter };
  }

  /**
   * 在页面上显示“不支持 WebGPU”的友好提示。
   */
  function showError(container, message) {
    const div = document.createElement('div');
    div.className = 'no-webgpu';
    div.innerHTML = '⚠️ ' + message +
      '<br><br>WebGPU 需要 Chrome 113+、Edge 113+ 或 Safari 17.4+，' +
      '且在某些系统上需启用硬件加速。';
    container.innerHTML = '';
    container.appendChild(div);
  }

  // ================= 4x4 矩阵运算（列主序，与 WGSL 一致）=================
  const mat4 = {
    identity() {
      return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
    },
    multiply(a, b) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
          out[i * 4 + j] = s;
        }
      }
      return out;
    },
    translation(tx, ty, tz) {
      const m = mat4.identity();
      m[12] = tx; m[13] = ty; m[14] = tz;
      return m;
    },
    scaling(sx, sy, sz) {
      const m = mat4.identity();
      m[0] = sx; m[5] = sy; m[10] = sz;
      return m;
    },
    rotationX(rad) {
      const c = Math.cos(rad), s = Math.sin(rad);
      const m = mat4.identity();
      m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
      return m;
    },
    rotationY(rad) {
      const c = Math.cos(rad), s = Math.sin(rad);
      const m = mat4.identity();
      m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
      return m;
    },
    rotationZ(rad) {
      const c = Math.cos(rad), s = Math.sin(rad);
      const m = mat4.identity();
      m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
      return m;
    },
    /**
     * 透视投影矩阵。注意：WebGPU 的 NDC 深度范围是 [0, 1]（不同于 WebGL 的 [-1, 1]）。
     */
    perspective(fovY, aspect, near, far) {
      const f = 1.0 / Math.tan(fovY / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, far * nf, -1,
        0, 0, near * far * nf, 0,
      ]);
    },
    /**
     * 正射投影矩阵（深度映射到 [0,1]）。
     */
    orthographic(left, right, bottom, top, near, far) {
      return new Float32Array([
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, 1 / (near - far), 0,
        (left + right) / (left - right),
        (bottom + top) / (bottom - top),
        near / (near - far),
        1,
      ]);
    },
    lookAt(eye, target, up) {
      const z = normalize(sub(eye, target));
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
      ]);
    },
    /** 求逆矩阵的转置（3x3），用于法线变换。返回 4x4（mat3 放入 mat4）。 */
    inverseTranspose(m) {
      const inv = invert(m);
      if (!inv) return mat4.identity();
      // 转置
      const t = new Float32Array(16);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          t[i * 4 + j] = inv[j * 4 + i];
      return t;
    },
  };

  // ---- 向量辅助 ----
  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l > 1e-6 ? [v[0]/l, v[1]/l, v[2]/l] : [0, 0, 0];
  }

  function invert(m) {
    const inv = new Float32Array(16);
    const a = m;
    inv[0] = a[5]*a[10]*a[15] - a[5]*a[11]*a[14] - a[9]*a[6]*a[15] + a[9]*a[7]*a[14] + a[13]*a[6]*a[11] - a[13]*a[7]*a[10];
    inv[4] = -a[4]*a[10]*a[15] + a[4]*a[11]*a[14] + a[8]*a[6]*a[15] - a[8]*a[7]*a[14] - a[12]*a[6]*a[11] + a[12]*a[7]*a[10];
    inv[8] = a[4]*a[9]*a[15] - a[4]*a[11]*a[13] - a[8]*a[5]*a[15] + a[8]*a[7]*a[13] + a[12]*a[5]*a[11] - a[12]*a[7]*a[9];
    inv[12] = -a[4]*a[9]*a[14] + a[4]*a[10]*a[13] + a[8]*a[5]*a[14] - a[8]*a[6]*a[13] - a[12]*a[5]*a[10] + a[12]*a[6]*a[9];
    inv[1] = -a[1]*a[10]*a[15] + a[1]*a[11]*a[14] + a[9]*a[2]*a[15] - a[9]*a[3]*a[14] - a[13]*a[2]*a[11] + a[13]*a[3]*a[10];
    inv[5] = a[0]*a[10]*a[15] - a[0]*a[11]*a[14] - a[8]*a[2]*a[15] + a[8]*a[3]*a[14] + a[12]*a[2]*a[11] - a[12]*a[3]*a[10];
    inv[9] = -a[0]*a[9]*a[15] + a[0]*a[11]*a[13] + a[8]*a[1]*a[15] - a[8]*a[3]*a[13] - a[12]*a[1]*a[11] + a[12]*a[3]*a[9];
    inv[13] = a[0]*a[9]*a[14] - a[0]*a[10]*a[13] - a[8]*a[1]*a[14] + a[8]*a[2]*a[13] + a[12]*a[1]*a[10] - a[12]*a[2]*a[9];
    inv[2] = a[1]*a[6]*a[15] - a[1]*a[7]*a[14] - a[5]*a[2]*a[15] + a[5]*a[3]*a[14] + a[13]*a[2]*a[7] - a[13]*a[3]*a[6];
    inv[6] = -a[0]*a[6]*a[15] + a[0]*a[7]*a[14] + a[4]*a[2]*a[15] - a[4]*a[3]*a[14] - a[12]*a[2]*a[7] + a[12]*a[3]*a[6];
    inv[10] = a[0]*a[5]*a[15] - a[0]*a[7]*a[13] - a[4]*a[1]*a[15] + a[4]*a[3]*a[13] + a[12]*a[1]*a[7] - a[12]*a[3]*a[5];
    inv[14] = -a[0]*a[5]*a[14] + a[0]*a[6]*a[13] + a[4]*a[1]*a[14] - a[4]*a[2]*a[13] - a[12]*a[1]*a[6] + a[12]*a[2]*a[5];
    inv[3] = -a[1]*a[6]*a[11] + a[1]*a[7]*a[10] + a[5]*a[2]*a[11] - a[5]*a[3]*a[10] - a[9]*a[2]*a[7] + a[9]*a[3]*a[6];
    inv[7] = a[0]*a[6]*a[11] - a[0]*a[7]*a[10] - a[4]*a[2]*a[11] + a[4]*a[3]*a[10] + a[8]*a[2]*a[7] - a[8]*a[3]*a[6];
    inv[11] = -a[0]*a[5]*a[11] + a[0]*a[7]*a[9] + a[4]*a[1]*a[11] - a[4]*a[3]*a[9] - a[8]*a[1]*a[7] + a[8]*a[3]*a[5];
    inv[15] = a[0]*a[5]*a[10] - a[0]*a[6]*a[9] - a[4]*a[1]*a[10] + a[4]*a[2]*a[9] + a[8]*a[1]*a[6] - a[8]*a[2]*a[5];
    let det = a[0]*inv[0] + a[1]*inv[4] + a[2]*inv[8] + a[3]*inv[12];
    if (Math.abs(det) < 1e-12) return null;
    det = 1.0 / det;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  }

  return { init, showError, mat4, vec: { sub, cross, dot, normalize } };
})();
