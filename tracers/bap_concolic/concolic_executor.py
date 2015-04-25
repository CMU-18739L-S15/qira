#!/usr/bin/env python2.7

from bap import bil
from bap import adt
from functools import partial
from model import BapInsn
from bitvector import ConcreteBitVector, SymbolicBitVector
from copy import copy
import collections
import z3

def symbolic_conditional(cond, true=z3.BitVecVal(1,8), false=z3.BitVecVal(0, 8)):
  return z3.If(cond, true, false)

class Memory(dict):
  def __init__(self, fetch_mem, initial=None):
    self.fetch_mem = fetch_mem
    self.constraints = []
    if initial is not None:
      self.update(initial)

  @staticmethod
  def _to_bitvec(bytelist):
    length = len(bytelist)*8
    value = bytelist[0]
    for b in bytelist[1:]:
      value = value.concat(b)
    return value

  def get_mem(self, addr, size, little_endian=True):
    # TODO: handle symbolic reads?
    addr = int(addr)
    memresult = [self[address] for address in range(addr, addr+size)]
    if little_endian: memresult = memresult[::-1]
    return self._to_bitvec(memresult)

  def set_mem(self, addr, size, val, little_endian=True):
    # TODO: handle symbolic writes
    addr = int(addr)
    for i in range(size):
      shift = i if little_endian else size-i-1
      if isinstance(val, ConcreteBitVector):
        byteval = ConcreteBitVector(8, int(val >> (shift*8)))
      if isinstance(val, SymbolicBitVector):
        byteval = SymbolicBitVector(8, z3.Extract((shift+1)*8-1, shift*8, val.expr))
      self[addr+i] = byteval

  def __getitem__(self, addr):
    addr = int(addr)
    if addr not in self:
      raw = ord(self.fetch_mem(addr, 1))
      self[addr] = ConcreteBitVector(8, raw)

    return self.get(addr)


class State:
  def __init__(self, variables, get_mem, initial_mem=None):
    self.variables = variables
    self.memory = Memory(get_mem, initial_mem)

  def get_mem(self, addr, size, little_endian=True):
    return self.memory.get_mem(addr, size, little_endian)

  def set_mem(self, addr, size, val, little_endian=True):
    return self.memory.set_mem(addr, size, val, little_endian)

  def __getitem__(self, name):
    if isinstance(name, str):
      return self.variables[name]
    else:
      raise Exception("Cannot get key")

  def __setitem__(self, name, val):
    if isinstance(name, str):
      self.variables[name] = val
    else:
      raise Exception("Cannot store key")

  def __str__(self):
    return str(self.variables)

  def get_copy(self):
    return State(copy(self.variables), self.memory.get_mem, copy(dict(self.memory)))

class VariableException(Exception):
  pass

class MemoryException(Exception):
  pass

class ConcolicExecutor(adt.Visitor):
  """
  Concolic Executor
  Takes an initial state, which may cotain both concrete and symbolic values
  Also takes the name of the PC register, which is used for taking branches
  """
  def __init__(self, state, pc, constraints=[]):
    self.state = state
    self.pc = pc
    self.constraints = constraints
    self.forks = []
    self.jumped = False

  def run_on_all_forks(self, bil_instrs):
    # run on every fork
    if not isinstance(bil_instrs, collections.Iterable):
      bil_instrs = [bil_instrs]

    for ins in bil_instrs:
      for f in self.forks:
        f.run(ins)
      for f in self.forks:
        # lift all forks to the top
        if f.forks != []:
          self.forks += f.forks
          f.forks = []
      self.run(ins)

  def visit_Load(self, op):
    addr = self.run(op.idx)
    return self.state.get_mem(addr, op.size / 8, isinstance(op.endian, bil.LittleEndian))

  def visit_Store(self, op):
    addr = self.run(op.idx)
    val = self.run(op.value)
    self.state.set_mem(addr, op.size / 8, val, isinstance(op.endian, bil.LittleEndian))
    return op.mem

  def visit_Var(self, op):
    try:
      return self.state[op.name]
    except KeyError as e:
      raise VariableException(op.name)

  def visit_Int(self, op):
    return ConcreteBitVector(op.size, op.value)

  def visit_Let(self, op):
    variables = self.state.variables
    tmp = variables.get(op.var.name, None)
    variables[op.var.name] = self.run(op.value)
    result = self.run(op.expr)
    if tmp is None:
      variables.pop(op.var.name, None)
    else:
      variables[op.var.name] = tmp
    return result

  def visit_Unknown(self, op):
    return ConcreteBitVector(1,0)

  def visit_Ite(self, op):
    cond = self.run(op.cond)
    if isinstance(cond, SymbolicBitVector):
      T = self.run(op.true)
      F = self.run(op.false)
      T = T.expr if isinstance(T, SymbolicBitVector) else z3.BitVecVal(T.value, T.size)
      F = F.expr if isinstance(F, SymbolicBitVector) else z3.BitVecVal(F.value, F.size)
      return SymbolicBitVector(T.size(), symbolic_conditional(cond == 1, T, F))
    return self.run(op.true) if cond == 1 else self.run(op.false)

  def visit_Extract(self, op):
    return self.run(op.expr).get_bits(op.low_bit, op.high_bit)

  def visit_Concat(self, op):
    return self.run(op.lhs).concat(self.run(op.rhs))

  def visit_Move(self, op):
    if isinstance(op.var.type, bil.Imm):
      result = self.run(op.expr)
      size = op.var.type.size
      if isinstance(result, SymbolicBitVector):
        result = SymbolicBitVector(size, result.expr)
      elif isinstance(result, ConcreteBitVector):
        result = ConcreteBitVector(size, int(result))
      else:
        raise Exception("Non-BitVector return result from {}".format(op.expr))

      self.state[op.var.name] = result
    else:
      self.run(op.expr) # no need to store Mems

  def visit_Jmp(self, op):
    self.jumped = True
    self.state[self.pc] = self.run(op.arg)

  def visit_While(self, op):
    while True:
      cond = self.run(op.cond)
      if isinstance(cond, SymbolicBitVector):
        raise Exception("Symbolic conditional not not implemented for While loops")
      else:
        if cond != 1:
          break
        adt.visit(self, op.stmts)

  def visit_If(self, op):
    cond = self.run(op.cond)
    if isinstance(cond, SymbolicBitVector):
      # always take the right branch in cases of Unkown or CPU Exception
      # TODO: Add more cases here. We should prevent forks as much as possible
      if isinstance(op.true, bil.CpuExn) or isinstance(op.true, bil.Unknown):
        self.constraints.append(cond == 0)
        self.run(op.false)
      elif isinstance(op.false, bil.CpuExn) or isinstance(op.false, bil.Unknown):
        self.constraints.append(cond == 1)
        self.run(op.true)
      else:
        # If we can't predict the right branch, fork and take both
        # Note: the order below matters to maintain forks correctly
        # TODO: refactor forking
        state_copy = self.state.get_copy()
        fork = ConcolicExecutor(state_copy, self.pc, constraints=self.constraints + [cond == 1])
        fork.run_on_all_forks(op.true)
        self.constraints.append(cond == 0)
        self.run_on_all_forks(op.false)
        self.forks.append(fork)
    else:
      if cond == 1:
        adt.visit(self, op.true)
      else:
        adt.visit(self, op.false)

  def visit_PLUS(self, op):
    return self.run(op.lhs) + self.run(op.rhs)

  def visit_MINUS(self, op):
    return self.run(op.lhs) - self.run(op.rhs)

  def visit_TIMES(self, op):
    return self.run(op.lhs) * self.run(op.rhs)

  def visit_DIVIDE(self, op):
    return self.run(op.lhs) / self.run(op.rhs)

  def visit_SDIVIDE(self, op):
    return self.run(op.lhs) / self.run(op.rhs)

  def visit_MOD(self, op):
    return self.run(op.lhs) % self.run(op.rhs)

  def visit_SMOD(self, op):
    return self.run(op.lhs) % self.run(op.rhs)

  def visit_LSHIFT(self, op):
    return self.run(op.lhs) << self.run(op.rhs)

  def visit_RSHIFT(self, op):
    return self.run(op.lhs) >> self.run(op.rhs)

  def visit_ARSHIFT(self, op):
    return self.run(op.lhs).arshift(self.run(op.rhs))

  def visit_AND(self, op):
    return self.run(op.lhs) & self.run(op.rhs)

  def visit_OR(self, op):
    return self.run(op.lhs) | self.run(op.rhs)

  def visit_XOR(self, op):
    return self.run(op.lhs) ^ self.run(op.rhs)

  def visit_EQ(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs == rhs))
    return ConcreteBitVector(1, 1 if lhs == rhs else 0)

  def visit_NEQ(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs != rhs))
    return ConcreteBitVector(1, 1 if lhs != rhs else 0)

  def visit_LT(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs < rhs))
    return ConcreteBitVector(1, 1 if lhs < rhs else 0)

  def visit_LE(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs <= rhs))
    return ConcreteBitVector(1, 1 if lhs <= rhs else 0)

  def visit_SLT(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs < rhs))
    return ConcreteBitVector(1, 1 if lhs < rhs else 0)

  def visit_SLE(self, op):
    lhs = self.run(op.lhs)
    rhs = self.run(op.rhs)
    if isinstance(lhs, SymbolicBitVector) or isinstance(rhs, SymbolicBitVector):
      return SymbolicBitVector(1, symbolic_conditional(lhs <= rhs))
    return ConcreteBitVector(1, 1 if lhs <= rhs else 0)

  def visit_NEG(self, op):
    return -self.run(op.arg)

  def visit_NOT(self, op):
    return ~self.run(op.arg)

  def visit_UNSIGNED(self, op):
    return self.run(op.expr).resize(op.size)

  def visit_SIGNED(self, op):
    return self.run(op.expr).resize(op.size)

  def visit_HIGH(self, op):
    return self.run(op.expr).get_high_bits(op.size)

  def visit_LOW(self, op):
    return self.run(op.expr).get_low_bits(op.size)

class Issue:
  def __init__(self, clnum, insn, message):
    self.clnum = clnum
    self.insn = insn
    self.message = message

class Warning(Issue):
  pass

class Error(Issue):
  pass

def validate_bil(program, flow):
  r"""
  Runs the concolic executor with fully concrete values,
  validating the the results are consistent with the trace.
  Returns a tuple of (Errors, Warnings)
  Currently only supports ARM, x86, and x86-64
  """

  trace = program.traces[0]
  libraries = [(m[3],m[1]) for m in trace.mapped]
  registers = program.tregs[0]
  regsize = 8 * program.tregs[1]
  arch = program.tregs[-1]

  if arch == "arm":
    cpu_flags = ["ZF", "CF", "NF", "VF"]
    PC = "PC"
  elif arch == "i386":
    cpu_flags = ["CF", "PF", "AF", "ZF", "SF", "OF", "DF"]
    PC = "EIP"
  elif arch == "x86-64":
    cpu_flags = ["CF", "PF", "AF", "ZF", "SF", "OF", "DF"]
    PC = "RIP"
  else:
    print "Architecture not supported"
    return [],[]


  errors = []
  warnings = []

  def new_state_for_clnum(clnum, include_flags=True):
    flags = cpu_flags if include_flags else []
    flagvalues = [0 for f in flags]
    varnames = registers + flags
    initial_regs = trace.db.fetch_registers(clnum)
    varvals = initial_regs + flagvalues
    varvals = map(lambda x: ConcreteBitVector(regsize, x), varvals)
    initial_vars = dict(zip(varnames, varvals))
    initial_mem_get = partial(trace.fetch_raw_memory, clnum)
    return State(initial_vars, initial_mem_get)

  state = new_state_for_clnum(0)

  for (addr,data,clnum,ins) in flow:
    instr = program.static[addr]['instruction']
    if not isinstance(instr, BapInsn):
      errors.append(Error(clnum, instr, "Could not make BAP instruction for %s" % str(instr)))
      state = new_state_for_clnum(clnum)
    else:
      bil_instrs = instr.insn.bil
      if bil_instrs is None:
        errors.append(Error(clnum, instr, "No BIL for instruction %s" % str(instr)))
        state = new_state_for_clnum(clnum)
      else:

        # this is bad.. fix this
        if arch == "arm":
          state[PC] += 8 #Qira PC is wrong

        executor = ConcolicExecutor(state, PC) # make a concolic exeuctor with fully concrete initial state

        try:
          adt.visit(executor, bil_instrs)
        except VariableException as e:
          errors.append(Error(clnum, instr, "No BIL variable %s!" % str(e.args[0])))
        except MemoryException as e:
          errors.append(Error(clnum, instr, "Used invalid address %x." % e.args[0]))

        if not executor.jumped:
          if arch == "arm":
            state[PC] -= 4
          elif arch == "i386" or arch == "x86-64":
            state[PC] += instr.size()

        validate = True
        PC_val = state[PC]
        if PC_val > 0xf0000000 or any([PC_val >= base and PC_val <= base+size for (base,size) in libraries]):
          # we are jumping into a library that we can't trace.. reset the state and continue
          warnings.append(Warning(clnum, instr, "Jumping into library. Cannot trace this"))
          state = new_state_for_clnum(clnum)
          continue

        error = False
        correct_regs = new_state_for_clnum(clnum, include_flags=False).variables

        for reg, correct in correct_regs.iteritems():
          if state[reg] != correct:
            error = True
            errors.append(Error(clnum, instr, "%s was incorrect! (%x != %x)." % (reg, state[reg] , correct)))
            state[reg] = correct

        for (addr, val) in state.memory.items():
          try:
            realval = ConcreteBitVector(8, ord(trace.fetch_raw_memory(clnum, addr, 1)))
          except Exception as e:
            errors.append(Error(clnum, instr, "Used invalid address %x." % addr))
            # this is unfixable, reset state
            state = new_state_for_clnum(clnum)
            continue
          if val != realval:
            error = True
            errors.append(Error(clnum, instr, "Value at address %x is wrong! (%x != %x)." % (addr, val, realval)))
            state.set_mem(addr, 1, realval)

  return (errors, warnings)

def satisfy_constraints(program, start_clnum, symbolic_registers, symbolic_memory, user_constraints, assistance):
  """
  Runs the concolic executor from a starting clnum, attempting to satisfy the contraints list.
  Uses concrete values for everything but the specified registers and memory addresses.
  """
  trace = program.traces[0]
  registers = program.tregs[0]
  regsize = 8 * program.tregs[1]
  PC = registers[-1]

  initial_mem_get = partial(trace.fetch_raw_memory, start_clnum)
  initial_regs = dict(zip(registers, map(lambda x: ConcreteBitVector(regsize, x), trace.db.fetch_registers(start_clnum))))

  # add symbolic registers
  for register in symbolic_registers:
    rs = [SymbolicBitVector(8, z3.BitVec(register+str(i), 8)) for i in range(regsize / 8)]
    r = rs[0]
    for rp in rs[1:]:
      r = r.concat(rp)
    initial_regs[register] = r

  # add symbolic memory
  initial_mem = {}
  for (address, length) in symbolic_memory:
    for addr in range(address, address+length):
      b = z3.BitVec("mem_{}".format(hex(addr)), 8)
      initial_mem[addr] = SymbolicBitVector(8, b)

  start_state = State(initial_regs, initial_mem_get, initial_mem)
  executors = [ConcolicExecutor(start_state, PC)]

  ################################ Below is experimental ################################

  try:
    # grab the initial executor
    executor = executors.pop(0)
    while True:
      # use the assistance
      for key, val in assistance['halt'].items():
        stateval = executor.state[key]
        if isinstance(stateval, ConcreteBitVector):
          if stateval == val:
            print "Assistance says to halt here. Switching fork."
            executor = executors.pop(len(executors)-1)
            continue

      # let's try to solve
      s = z3.Solver()

      # add user contraints on registers
      for key, value in user_constraints['registers'].items():
        s.add(executor.state[key] == value)

      # add user constraints on memory
      for key, (size, value) in user_constraints['memory'].items():
        s.add(executor.state.get_mem(int(key, 16), size) == value)

      # add constraints accumulated from this execution path
      for constraint in executor.constraints:
        s.add(constraint)

      # Try to solve
      if s.check().r == 1:
        return True, s.model()

      # If we failed, let's run an instruction
      pc_value = int(executor.state[PC])
      instr = program.static[pc_value]['instruction']

      # If BAP can't handle the instruction, let's stop
      if not isinstance(instr, BapInsn):
        print "Bad Instruction. Switching fork."
        executor = executors.pop(len(executors)-1)
        continue

      bil_instrs = instr.insn.bil

      try:
        executor.run_on_all_forks(bil_instrs)
      except Exception as e:
        print "Error during symbolic execution. Switching fork."
        executor = executors.pop(len(executors)-1)
        continue

      # For each fork, step the PC.
      for e in [executor] + executor.forks:
        if not e.jumped:
          e.state[PC] += instr.size()
        else:
          e.jumped = False

      # Gather the forks
      executors += executor.forks
      executor.forks = []

  except IndexError as e:
    print "No forks left => UNSAT"
    return False, None
