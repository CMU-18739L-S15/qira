#include <stdio.h>

int fib_tail(int x, int a)
{
	if (x <= 0)
		return a;
	else
		return fib_tail(x-1, a*x);
}

int fib(int x)
{
	return fib_tail(x, 1);
}

int main()
{
	printf("%d.\n", fib(5));
	return 0;
}
